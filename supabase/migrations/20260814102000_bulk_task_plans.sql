begin;

alter table public.tasks
  add column if not exists plan_batch_id uuid;

create index if not exists idx_tasks_plan_batch_id
  on public.tasks(plan_batch_id, created_at);

create or replace function public.create_bulk_task_plan(
  p_actor_id uuid,
  p_plan_period text,
  p_due_date date,
  p_reviewer_id uuid,
  p_description text,
  p_items jsonb,
  p_batch_id uuid default gen_random_uuid()
)
returns setof public.tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role_code text;
  v_can_create boolean;
  v_item jsonb;
  v_title text;
  v_existing_count integer;
begin
  if p_batch_id is null then
    raise exception 'Mã lần lập kế hoạch không hợp lệ.' using errcode = '22023';
  end if;

  select r.code, coalesce(rp.can_create_task, false)
    into v_role_code, v_can_create
    from public.staff_users u
    join public.roles r on r.id = u.role_id
    left join public.role_permissions rp on rp.role_id = r.id
   where u.id = p_actor_id and u.active = true;
  if v_role_code is null or v_role_code not in ('admin','pho_tong_bien_tap','phu_trach_phong_tri_su','phu_trach_phong_phong_vien','phu_trach_phong_bien_tap') then
    raise exception 'Bạn không có quyền lập kế hoạch.' using errcode = '42501';
  end if;
  if v_role_code in ('tong_bien_tap', 'tbt_read_only') then
    raise exception 'Tài khoản chỉ được xem, không được lập kế hoạch.' using errcode = '42501';
  end if;
  if p_plan_period not in ('daily', 'weekly') then
    raise exception 'Kỳ kế hoạch không hợp lệ.' using errcode = '22023';
  end if;
  if p_due_date is null then
    raise exception 'Deadline là bắt buộc.' using errcode = '22023';
  end if;
  if p_reviewer_id is null or not exists (
    select 1 from public.staff_users u join public.roles r on r.id = u.role_id
     where u.id = p_reviewer_id and u.active
       and r.code in ('phu_trach_phong_tri_su','phu_trach_phong_phong_vien','phu_trach_phong_bien_tap','pho_tong_bien_tap','tong_bien_tap')
  ) then
    raise exception 'Người nhận báo cáo không hợp lệ.' using errcode = '42501';
  end if;
  if p_description is null or length(btrim(p_description)) = 0 or length(p_description) > 10000 then
    raise exception 'Mô tả chung là bắt buộc và tối đa 10000 ký tự.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception 'Cần có từ 1 đến 100 việc trong kế hoạch.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_batch_id::text, 0));
  if exists (select 1 from public.tasks where plan_batch_id = p_batch_id and created_by is distinct from p_actor_id) then
    raise exception 'Mã lần lập kế hoạch đã được sử dụng.' using errcode = '42501';
  end if;
  select count(*) into v_existing_count from public.tasks where plan_batch_id = p_batch_id and created_by = p_actor_id;
  if v_existing_count > 0 then
    return query select * from public.tasks where plan_batch_id = p_batch_id and created_by = p_actor_id order by created_at, id;
    return;
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_title := btrim(v_item->>'title');
    if v_title is null or length(v_title) = 0 or length(v_title) > 500 then
      raise exception 'Tên việc phải từ 1 đến 500 ký tự.' using errcode = '22023';
    end if;
    insert into public.tasks(
      title, description, plan_period, due_date, reviewer_id, created_by,
      self_claimable, assignment_mode, status, progress_percent, plan_batch_id
    ) values (
      v_title, btrim(p_description), p_plan_period, p_due_date, p_reviewer_id, p_actor_id,
      true, 'individual', 'new', 0, p_batch_id
    );
  end loop;

  return query select * from public.tasks where plan_batch_id = p_batch_id and created_by = p_actor_id order by created_at, id;
end;
$$;

revoke all on function public.create_bulk_task_plan(uuid,text,date,uuid,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.create_bulk_task_plan(uuid,text,date,uuid,text,jsonb,uuid) to service_role;
alter function public.create_bulk_task_plan(uuid,text,date,uuid,text,jsonb,uuid) owner to postgres;

create or replace function public.report_task_progress(
  p_actor_id uuid,
  p_task_id uuid,
  p_progress integer,
  p_report text,
  p_blockers text default null
)
returns public.tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.tasks;
  v_role_code text;
  v_allowed boolean;
  v_note text;
  v_old_progress integer;
begin
  select r.code into v_role_code from public.staff_users u join public.roles r on r.id = u.role_id where u.id = p_actor_id and u.active;
  if v_role_code is null or v_role_code in ('tong_bien_tap', 'tbt_read_only') then
    raise exception 'Tài khoản không được gửi báo cáo.' using errcode = '42501';
  end if;
  if p_progress not between 0 and 100 then raise exception 'Tiến độ phải từ 0 đến 100.' using errcode = '22023'; end if;
  if p_report is null or length(btrim(p_report)) = 0 or length(p_report) > 10000 then
    raise exception 'Nội dung báo cáo là bắt buộc và tối đa 10000 ký tự.' using errcode = '22023';
  end if;

  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then raise exception 'Không tìm thấy công việc.' using errcode = 'P0002'; end if;
  if v_task.status = 'done' then raise exception 'Công việc đã hoàn thành.' using errcode = '22023'; end if;
  v_old_progress := v_task.progress_percent;
  select v_role_code = 'admin'
      or v_task.assignee_id = p_actor_id
      or v_task.owner_id = p_actor_id
      or exists (select 1 from public.task_assignees ta where ta.task_id = p_task_id and ta.user_id = p_actor_id and ta.assignment_role <> 'watcher')
    into v_allowed;
  if not v_allowed then raise exception 'Chỉ người thực hiện/owner mới được gửi báo cáo.' using errcode = '42501'; end if;

  update public.tasks set progress_percent = p_progress,
      status = case when p_progress = 100 then 'pending_review' when status in ('new','rejected') then 'in_progress' else status end,
      updated_at = now()
   where id = p_task_id returning * into v_task;
  v_note := 'Báo cáo: ' || btrim(p_report) || case when nullif(btrim(coalesce(p_blockers, '')), '') is null then '' else ' | Vướng mắc: ' || btrim(p_blockers) end;
  insert into public.task_progress_logs(task_id,user_id,old_progress,new_progress,note)
  values (p_task_id,p_actor_id,coalesce(v_old_progress, 0),p_progress,v_note);
  insert into public.task_comments(task_id,user_id,content)
  values (p_task_id,p_actor_id,'📣 Báo cáo tiến độ (' || p_progress || '%): ' || btrim(p_report) || case when nullif(btrim(coalesce(p_blockers, '')), '') is null then '' else E'\n⚠️ Vướng mắc: ' || btrim(p_blockers) end);
  return v_task;
end;
$$;

create or replace function public.review_task_completion(
  p_actor_id uuid,
  p_task_id uuid,
  p_decision text,
  p_note text default null
)
returns public.tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.tasks;
  v_role_code text;
  v_allowed boolean;
begin
  select r.code into v_role_code from public.staff_users u join public.roles r on r.id = u.role_id where u.id = p_actor_id and u.active;
  if v_role_code is null or v_role_code in ('tong_bien_tap', 'tbt_read_only') then
    raise exception 'Tài khoản chỉ được xem, không được duyệt.' using errcode = '42501';
  end if;
  if p_decision not in ('approve','reject') then raise exception 'Quyết định duyệt không hợp lệ.' using errcode = '22023'; end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then raise exception 'Không tìm thấy công việc.' using errcode = 'P0002'; end if;
  select v_role_code = 'admin' or v_task.created_by = p_actor_id or (
      v_task.reviewer_id = p_actor_id and v_role_code in ('pho_tong_bien_tap','phu_trach_phong_tri_su','phu_trach_phong_phong_vien','phu_trach_phong_bien_tap')
    ) into v_allowed;
  if not v_allowed then raise exception 'Chỉ người nhận báo cáo, người tạo hoặc admin mới được duyệt.' using errcode = '42501'; end if;
  if v_task.status <> 'pending_review' then raise exception 'Công việc chưa ở trạng thái chờ duyệt.' using errcode = '22023'; end if;
  update public.tasks set status = case when p_decision = 'approve' then 'done' else 'rejected' end,
      progress_percent = case when p_decision = 'approve' then 100 else progress_percent end,
      updated_at = now()
   where id = p_task_id returning * into v_task;
  insert into public.task_comments(task_id,user_id,content) values (
    p_task_id,p_actor_id,
    case when p_decision = 'approve' then '✅ Đã phê duyệt hoàn thành.' else '↩️ Đã trả lại để bổ sung.' end
      || case when nullif(btrim(coalesce(p_note, '')), '') is null then '' else E'\n' || btrim(p_note) end
  );
  return v_task;
end;
$$;

revoke all on function public.report_task_progress(uuid,uuid,integer,text,text) from public, anon, authenticated;
grant execute on function public.report_task_progress(uuid,uuid,integer,text,text) to service_role;
alter function public.report_task_progress(uuid,uuid,integer,text,text) owner to postgres;
revoke all on function public.review_task_completion(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.review_task_completion(uuid,uuid,text,text) to service_role;
alter function public.review_task_completion(uuid,uuid,text,text) owner to postgres;

commit;

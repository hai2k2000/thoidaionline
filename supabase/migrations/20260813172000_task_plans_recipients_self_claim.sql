begin;

alter table public.tasks
  add column if not exists plan_period text not null default 'ad_hoc',
  add column if not exists self_claimable boolean not null default false;

alter table public.tasks drop constraint if exists tasks_plan_period_check;
alter table public.tasks add constraint tasks_plan_period_check
  check (plan_period in ('ad_hoc', 'daily', 'weekly'));

create index if not exists idx_tasks_self_claimable
  on public.tasks(self_claimable, status, plan_period, due_date);

create or replace function public.validate_task_report_recipient()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_role_code text;
  v_active boolean;
begin
  if new.reviewer_id is not null then
    select r.code, u.active into v_role_code, v_active
      from public.staff_users u
      join public.roles r on r.id = u.role_id
     where u.id = new.reviewer_id;

    if v_role_code is null or coalesce(v_active, false) = false then
      raise exception 'Người nhận báo cáo không hợp lệ.' using errcode = '22023';
    end if;

    if v_role_code not in (
      'phu_trach_phong_tri_su',
      'phu_trach_phong_phong_vien',
      'phu_trach_phong_bien_tap',
      'pho_tong_bien_tap',
      'tong_bien_tap'
    ) then
      raise exception 'Người nhận báo cáo phải là Trưởng phòng, Phó tổng biên tập hoặc Tổng biên tập.' using errcode = '42501';
    end if;
  end if;

  if new.self_claimable and new.assignment_mode <> 'individual' then
    raise exception 'Kế hoạch tự nhận chỉ hỗ trợ kiểu giao cá nhân.' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_task_report_recipient on public.tasks;
create trigger validate_task_report_recipient
before insert or update of reviewer_id, self_claimable, assignment_mode on public.tasks
for each row execute function public.validate_task_report_recipient();

update public.role_permissions rp
   set can_create_task = true,
       can_edit_all_tasks = true,
       updated_at = now()
  from public.roles r
 where r.id = rp.role_id
   and r.code in (
     'pho_tong_bien_tap',
     'phu_trach_phong_tri_su',
     'phu_trach_phong_phong_vien',
     'phu_trach_phong_bien_tap'
   );

create or replace function public.claim_task_plan(p_actor_id uuid, p_task_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks;
  v_role_code text;
begin
  select r.code into v_role_code
    from public.staff_users u
    join public.roles r on r.id = u.role_id
   where u.id = p_actor_id and u.active = true;

  if v_role_code is null or v_role_code = 'tbt_read_only' then
    raise exception 'Tài khoản không được tự nhận kế hoạch.' using errcode = '42501';
  end if;

  select * into v_task from public.tasks
   where id = p_task_id
     and self_claimable = true
     and plan_period in ('daily', 'weekly')
     and status = 'new'
     and assignee_id is null
   for update;

  if not found then
    raise exception 'Kế hoạch không còn khả dụng để tự nhận.' using errcode = '40001';
  end if;

  update public.tasks
     set assignee_id = p_actor_id,
         owner_id = p_actor_id,
         status = 'in_progress',
         updated_at = now()
   where id = p_task_id
   returning * into v_task;

  insert into public.task_assignees(task_id, user_id, assignment_role, status)
  values (p_task_id, p_actor_id, 'owner', 'in_progress')
  on conflict (task_id, user_id) do update
    set assignment_role = 'owner', status = 'in_progress';

  return v_task;
end;
$$;

revoke all on function public.claim_task_plan(uuid, uuid) from public;
grant execute on function public.claim_task_plan(uuid, uuid) to anon;

-- The selected recipient is the normal approver/evaluator. TBT roles retain
-- organisation-wide evaluation authority.
create or replace function public.save_task_evaluation_checkpoint(
  p_actor_id uuid,
  p_task_id uuid,
  p_employee_id uuid,
  p_rating integer,
  p_effort_weight integer,
  p_completion text,
  p_on_time boolean,
  p_opinion text,
  p_checkpoint_date date,
  p_is_final boolean
)
returns public.task_evaluation_checkpoints
language plpgsql
security definer
set search_path = public
as $$
declare
  v_checkpoint public.task_evaluation_checkpoints;
  v_allowed boolean;
begin
  select exists (
    select 1
      from public.staff_users u
      join public.roles r on r.id = u.role_id
      join public.tasks t on t.id = p_task_id
     where u.id = p_actor_id
       and u.active = true
       and (
         r.code in ('tong_bien_tap', 'tbt_read_only')
         or (
           t.reviewer_id = p_actor_id
           and r.code in (
             'pho_tong_bien_tap',
             'phu_trach_phong_tri_su',
             'phu_trach_phong_phong_vien',
             'phu_trach_phong_bien_tap'
           )
         )
       )
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Bạn không phải người nhận báo cáo hoặc không có quyền đánh giá công việc.' using errcode = '42501';
  end if;

  if p_rating not between 1 and 10 then
    raise exception 'Điểm đánh giá phải từ 1 đến 10.' using errcode = '22023';
  end if;

  if p_effort_weight not in (1, 2, 3, 5, 8) then
    raise exception 'Trọng số công việc không hợp lệ.' using errcode = '22023';
  end if;

  if p_completion not in ('not_done', 'done', 'excellent') then
    raise exception 'Mức hoàn thành không hợp lệ.' using errcode = '22023';
  end if;

  if p_checkpoint_date is null then
    raise exception 'Ngày đánh giá là bắt buộc.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.tasks t
     where t.id = p_task_id
       and (
         t.assignee_id = p_employee_id
         or exists (
           select 1 from public.task_assignees ta
            where ta.task_id = t.id
              and ta.user_id = p_employee_id
              and ta.assignment_role <> 'watcher'
         )
       )
  ) then
    raise exception 'Nhân viên không được giao công việc này.' using errcode = '22023';
  end if;

  update public.tasks set effort_weight = p_effort_weight, updated_at = now()
   where id = p_task_id;

  insert into public.task_evaluation_checkpoints (
    task_id, employee_id, reviewer_id, rating, effort_weight,
    completion, on_time, opinion, checkpoint_date, is_final
  ) values (
    p_task_id, p_employee_id, p_actor_id, p_rating, p_effort_weight,
    p_completion, p_on_time, nullif(btrim(p_opinion), ''), p_checkpoint_date, p_is_final
  ) returning * into v_checkpoint;

  return v_checkpoint;
end;
$$;

revoke all on function public.save_task_evaluation_checkpoint(uuid, uuid, uuid, integer, integer, text, boolean, text, date, boolean) from public;
grant execute on function public.save_task_evaluation_checkpoint(uuid, uuid, uuid, integer, integer, text, boolean, text, date, boolean) to anon;

commit;

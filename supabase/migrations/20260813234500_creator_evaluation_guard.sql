-- Allow the trusted creator of a task to evaluate that task. Reviewer/admin
-- policy remains unchanged; TBT roles are intentionally view-only.
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
set search_path = public, pg_temp
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
         r.code = 'admin'
         or (
           t.created_by = p_actor_id
           and r.code not in ('tong_bien_tap', 'tbt_read_only')
         )
         or (
           t.reviewer_id = p_actor_id
           and r.code in ('pho_tong_bien_tap', 'phu_trach_phong_tri_su', 'phu_trach_phong_phong_vien', 'phu_trach_phong_bien_tap')
         )
       )
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Bạn không phải người giao/nhận báo cáo hoặc không có quyền đánh giá công việc.' using errcode = '42501';
  end if;
  if p_rating not between 1 and 10 then raise exception 'Điểm đánh giá phải từ 1 đến 10.' using errcode = '22023'; end if;
  if p_effort_weight not in (1, 2, 3, 5, 8) then raise exception 'Trọng số công việc không hợp lệ.' using errcode = '22023'; end if;
  if p_completion not in ('not_done', 'done', 'excellent') then raise exception 'Mức hoàn thành không hợp lệ.' using errcode = '22023'; end if;
  if p_checkpoint_date is null then raise exception 'Ngày đánh giá là bắt buộc.' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.tasks t
     where t.id = p_task_id
       and (t.assignee_id = p_employee_id or exists (
         select 1 from public.task_assignees ta where ta.task_id = t.id and ta.user_id = p_employee_id and ta.assignment_role <> 'watcher'
       ))
  ) then raise exception 'Nhân viên không được giao công việc này.' using errcode = '22023'; end if;

  update public.tasks set effort_weight = p_effort_weight, updated_at = now() where id = p_task_id;
  insert into public.task_evaluation_checkpoints(task_id, employee_id, reviewer_id, rating, effort_weight, completion, on_time, opinion, checkpoint_date, is_final)
  values (p_task_id, p_employee_id, p_actor_id, p_rating, p_effort_weight, p_completion, p_on_time, nullif(btrim(p_opinion), ''), p_checkpoint_date, p_is_final)
  returning * into v_checkpoint;
  return v_checkpoint;
end;
$$;

revoke all on function public.save_task_evaluation_checkpoint(uuid, uuid, uuid, integer, integer, text, boolean, text, date, boolean) from public, anon, authenticated;
grant execute on function public.save_task_evaluation_checkpoint(uuid, uuid, uuid, integer, integer, text, boolean, text, date, boolean) to service_role;
alter function public.save_task_evaluation_checkpoint(uuid, uuid, uuid, integer, integer, text, boolean, text, date, boolean) owner to postgres;
alter function public.save_task_evaluation_checkpoint(uuid, uuid, uuid, integer, integer, text, boolean, text, date, boolean) set search_path = public, pg_temp;

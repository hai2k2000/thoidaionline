begin;

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
    left join public.role_permissions rp on rp.role_id = r.id
    where u.id = p_actor_id
      and u.active = true
      and (r.code in ('tong_bien_tap', 'tbt_read_only') or coalesce(rp.can_manage_users, false) = true)
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Bạn không có quyền lưu đánh giá công việc.' using errcode = '42501';
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
    select 1
    from public.tasks t
    where t.id = p_task_id
      and (
        t.assignee_id = p_employee_id
        or exists (
          select 1 from public.task_assignees ta
          where ta.task_id = t.id and ta.user_id = p_employee_id and ta.assignment_role <> 'watcher'
        )
      )
  ) then
    raise exception 'Nhân viên không được giao công việc này.' using errcode = '22023';
  end if;

  update public.tasks
  set effort_weight = p_effort_weight,
      updated_at = now()
  where id = p_task_id;

  insert into public.task_evaluation_checkpoints (
    task_id, employee_id, reviewer_id, rating, effort_weight,
    completion, on_time, opinion, checkpoint_date, is_final
  ) values (
    p_task_id, p_employee_id, p_actor_id, p_rating, p_effort_weight,
    p_completion, p_on_time, nullif(btrim(p_opinion), ''), p_checkpoint_date, p_is_final
  )
  returning * into v_checkpoint;

  return v_checkpoint;
end;
$$;

revoke all on function public.save_task_evaluation_checkpoint(uuid, uuid, uuid, integer, integer, text, boolean, text, date, boolean) from public;
grant execute on function public.save_task_evaluation_checkpoint(uuid, uuid, uuid, integer, integer, text, boolean, text, date, boolean) to anon;

commit;
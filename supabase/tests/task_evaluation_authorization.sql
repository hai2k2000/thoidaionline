\set ON_ERROR_STOP on

begin;

do $$
declare
  v_tbt_id uuid;
  v_admin_id uuid;
  v_staff_id uuid;
  v_task_id uuid;
  v_employee_id uuid;
begin
  select u.id
  into v_tbt_id
  from public.staff_users u
  join public.roles r on r.id = u.role_id
  where u.active = true
    and r.code = 'tbt_read_only'
  order by u.created_at
  limit 1;

  select u.id
  into v_admin_id
  from public.staff_users u
  join public.roles r on r.id = u.role_id
  join public.role_permissions rp on rp.role_id = r.id
  where u.active = true
    and rp.can_manage_users = true
  order by u.created_at
  limit 1;

  select t.id, assigned.employee_id
  into v_task_id, v_employee_id
  from public.tasks t
  cross join lateral (
    select t.assignee_id as employee_id
    where t.assignee_id is not null
    union all
    select ta.user_id
    from public.task_assignees ta
    where ta.task_id = t.id
      and ta.assignment_role <> 'watcher'
  ) assigned
  order by t.created_at desc
  limit 1;

  select u.id
  into v_staff_id
  from public.staff_users u
  join public.roles r on r.id = u.role_id
  left join public.role_permissions rp on rp.role_id = r.id
  where u.active = true
    and r.code not in ('tong_bien_tap', 'tbt_read_only')
    and coalesce(rp.can_manage_users, false) = false
  order by u.created_at
  limit 1;

  if v_tbt_id is null or v_admin_id is null or v_staff_id is null or v_task_id is null or v_employee_id is null then
    raise exception 'Authorization test fixtures are incomplete.';
  end if;

  perform public.save_task_evaluation_checkpoint(
    v_tbt_id, v_task_id, v_employee_id, 8, 1, 'done', true,
    'TBT authorization regression test', current_date, false
  );

  perform public.save_task_evaluation_checkpoint(
    v_admin_id, v_task_id, v_employee_id, 8, 1, 'done', true,
    'Administrator authorization regression test', current_date, false
  );

  begin
    perform public.save_task_evaluation_checkpoint(
      v_staff_id, v_task_id, v_employee_id, 8, 1, 'done', true,
      'Ordinary staff authorization regression test', current_date, false
    );
    raise exception 'Ordinary staff unexpectedly saved a task evaluation.';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

rollback;

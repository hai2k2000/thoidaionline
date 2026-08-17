\set ON_ERROR_STOP on

begin;

do $$
declare
  v_reviewer uuid;
  v_employee uuid;
  v_task uuid;
  v_claimed public.tasks;
begin
  select u.id into v_reviewer
    from public.staff_users u join public.roles r on r.id = u.role_id
   where u.active and r.code in (
     'phu_trach_phong_tri_su', 'phu_trach_phong_phong_vien',
     'phu_trach_phong_bien_tap', 'pho_tong_bien_tap', 'tong_bien_tap'
   )
   order by u.created_at limit 1;

  select u.id into v_employee
    from public.staff_users u join public.roles r on r.id = u.role_id
   where u.active and r.code in ('phong_vien', 'bien_tap_vien', 'tri_su')
   order by u.created_at limit 1;

  if v_reviewer is null or v_employee is null then
    raise exception 'Workflow smoke-test fixtures are incomplete.';
  end if;

  insert into public.tasks(
    title, description, assignment_mode, plan_period,
    self_claimable, reviewer_id, due_date
  ) values (
    '__workflow_test__', 'temporary test', 'individual', 'daily',
    true, v_reviewer, current_date
  ) returning id into v_task;

  if (select priority from public.tasks where id = v_task) <> 'normal' then
    raise exception 'Task created without priority did not receive the neutral legacy default.';
  end if;

  v_claimed := public.claim_task_plan(v_employee, v_task);
  if v_claimed.assignee_id <> v_employee or v_claimed.status <> 'in_progress' then
    raise exception 'Self-claim assertion failed.';
  end if;

  begin
    insert into public.tasks(title, assignment_mode, plan_period, self_claimable, reviewer_id)
    values ('__invalid_recipient__', 'individual', 'ad_hoc', false, v_employee);
    raise exception 'Invalid report recipient was accepted.';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.tasks(title, assignment_mode, plan_period, self_claimable, reviewer_id)
    values ('__invalid_self_claim__', 'mixed', 'daily', true, v_reviewer);
    raise exception 'Invalid self-claim plan was accepted.';
  exception when invalid_parameter_value then
    null;
  end;
end;
$$;

rollback;

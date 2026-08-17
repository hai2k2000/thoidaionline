\set ON_ERROR_STOP on

begin;

do $$
declare
  v_reviewer uuid;
  v_task public.tasks;
begin
  select u.id into v_reviewer
    from public.staff_users u
    join public.roles r on r.id = u.role_id
   where u.active
     and r.code in ('phu_trach_phong_tri_su', 'phu_trach_phong_phong_vien',
                    'phu_trach_phong_bien_tap', 'pho_tong_bien_tap', 'tong_bien_tap')
   order by u.created_at
   limit 1;

  if v_reviewer is null then
    raise exception 'Compatibility smoke-test fixture is incomplete.';
  end if;

  -- This mirrors the new API payload: priority is intentionally omitted.
  insert into public.tasks(
    title, description, assignment_mode, plan_period,
    self_claimable, reviewer_id, due_date
  ) values (
    '__priority_compatibility_test__', 'temporary test', 'individual', 'ad_hoc',
    false, v_reviewer, current_date
  ) returning * into v_task;

  if v_task.priority <> 'normal' then
    raise exception 'Omitted priority must use neutral default normal, got %', v_task.priority;
  end if;

  if not exists (select 1 from public.tasks where id = v_task.id and priority = 'normal') then
    raise exception 'Inserted task cannot be read with its legacy priority value.';
  end if;
end;
$$;

rollback;

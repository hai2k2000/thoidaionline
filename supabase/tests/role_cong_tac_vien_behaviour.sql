begin;

-- The runner supplies the real revert script with only BEGIN/COMMIT removed.
select set_config('role_ctv.revert_sql', :'revert_sql', true);

do $$
declare
  ctv uuid;
begin
  select id into strict ctv from public.roles
  where code = 'cong_tac_vien' and active is true and level = 1;
  if not exists (
    select 1 from public.role_permissions where role_id = ctv
      and can_comment is true
      and can_manage_users is false and can_manage_permissions is false
      and can_create_task is false and can_edit_all_tasks is false
      and can_assign_task is false and can_view_department_tasks is false
      and can_evaluate_step1 is false and can_evaluate_step2 is false
      and can_manage_rubrics is false
  ) then raise exception 'CTV legacy permissions mismatch'; end if;

  if not ((select count(*) from public.role_permission_grants where role_id = ctv) = 2)
    or exists (
      select 1 from public.role_permission_grants g
      left join public.permissions p on p.id = g.permission_id
      where g.role_id = ctv and (p.code is null or p.code not in ('task.view', 'task.comment')
        or g.scope is distinct from 'assigned')
    ) or exists (
      select 1 from (values ('task.view'), ('task.comment')) expected(code)
      where not exists (
        select 1 from public.role_permission_grants g join public.permissions p on p.id = g.permission_id
        where g.role_id = ctv and p.code = expected.code and g.scope = 'assigned'
      )
    ) then raise exception 'CTV must have exactly the two assigned task grants'; end if;

  if exists (select 1 from public.role_permission_grants
             where role_id = ctv and scope in ('organization', 'department', 'all')) then
    raise exception 'CTV has a broad scope';
  end if;
end $$;

savepoint role_ctv_assignment;
do $$
declare
  ctv uuid := (select id from public.roles where code = 'cong_tac_vien');
  refused boolean := false;
begin
  update public.staff_users set role_id = ctv
  where id = (select id from public.staff_users order by id limit 1);
  if not found then raise exception 'Revert refusal test needs a restored staff row'; end if;
  -- EXCEPTION creates a subtransaction around the actual revert body.
  begin
    execute current_setting('role_ctv.revert_sql');
  exception when raise_exception then
    if sqlerrm <> 'Cannot revert cong_tac_vien while staff_users still reference this role' then
      raise;
    end if;
    refused := true;
  end;
  if not refused then raise exception 'Revert accepted an assigned CTV role'; end if;
  if not exists (select 1 from public.roles where id = ctv)
    or (select count(*) from public.role_permission_grants where role_id = ctv) <> 2
    or not exists (select 1 from public.role_permissions where role_id = ctv)
    or not exists (select 1 from public.staff_users where role_id = ctv) then
    raise exception 'Refused revert changed role, grants or staff assignment';
  end if;
end $$;
rollback to savepoint role_ctv_assignment;
release savepoint role_ctv_assignment;

rollback;

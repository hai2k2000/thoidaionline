\set ON_ERROR_STOP on
begin;

do $test$
declare
  v_tbt record;
  v_read_only record;
  v_bad_managers integer;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='role_permissions'
      and column_name='can_assign_task' and data_type='boolean' and is_nullable='NO'
  ) then raise exception 'missing can_assign_task'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='role_permissions'
      and column_name='can_view_department_tasks' and data_type='boolean' and is_nullable='NO'
  ) then raise exception 'missing can_view_department_tasks'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='role_permissions'
      and column_name='can_evaluate_step1' and data_type='boolean' and is_nullable='NO'
  ) then raise exception 'missing can_evaluate_step1'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='role_permissions'
      and column_name='can_evaluate_step2' and data_type='boolean' and is_nullable='NO'
  ) then raise exception 'missing can_evaluate_step2'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='role_permissions'
      and column_name='can_manage_rubrics' and data_type='boolean' and is_nullable='NO'
  ) then raise exception 'missing can_manage_rubrics'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='departments'
      and column_name='manager_id' and data_type='uuid'
  ) then raise exception 'missing departments.manager_id'; end if;

  if exists (
    select 1 from public.roles r
    left join public.role_permissions rp on rp.role_id=r.id
    where rp.role_id is null
  ) then raise exception 'role without permission row'; end if;

  select rp.* into v_tbt
  from public.roles r join public.role_permissions rp on rp.role_id=r.id
  where r.code='tong_bien_tap';
  if not v_tbt.can_comment
     or v_tbt.can_assign_task or v_tbt.can_view_department_tasks
     or v_tbt.can_evaluate_step1 or not v_tbt.can_evaluate_step2
     or v_tbt.can_manage_rubrics then
    raise exception 'TBT must be global-view/comment plus step2-only';
  end if;

  select rp.* into v_read_only
  from public.roles r join public.role_permissions rp on rp.role_id=r.id
  where r.code='tbt_read_only';
  if v_read_only.can_comment
     or v_read_only.can_assign_task or v_read_only.can_view_department_tasks
     or v_read_only.can_evaluate_step1 or v_read_only.can_evaluate_step2
     or v_read_only.can_manage_rubrics then
    raise exception 'tbt_read_only must remain compatibility read-only';
  end if;

  select count(*) into v_bad_managers
  from public.departments d
  join public.staff_users u on u.id=d.manager_id
  where u.department_id<>d.id or not u.active;
  if v_bad_managers<>0 then raise exception 'invalid primary manager'; end if;

  if not has_table_privilege('anon','public.tasks','SELECT') then
    raise exception 'Phase 1 must preserve anon compatibility';
  end if;
end
$test$;

rollback;

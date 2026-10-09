\set ON_ERROR_STOP on

create or replace function pg_temp.expect_error(p_label text, p_sql text, p_codes text[])
returns void
language plpgsql
as $function$
declare
  v_code text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    if not (v_code = any(p_codes)) then
      raise exception '%: expected SQLSTATE in %, got %', p_label, p_codes, v_code;
    end if;
    return;
  end;
  raise exception '%: expected an error', p_label;
end;
$function$;

begin;

insert into public.roles (id, code, name, level, active) values
  ('91000000-0000-0000-0000-000000000001', 'asset_v2_admin', 'Asset V2 Admin', 5, true),
  ('91000000-0000-0000-0000-000000000002', 'asset_v2_employee', 'Asset V2 Employee', 1, true)
on conflict (id) do update set active = true;

insert into public.role_permission_grants (role_id, permission_id, scope)
select '91000000-0000-0000-0000-000000000001', id, 'all'
from public.permissions where code in ('asset.view', 'asset.manage')
on conflict (role_id, permission_id, scope) do nothing;
insert into public.role_permission_grants (role_id, permission_id, scope)
select '91000000-0000-0000-0000-000000000002', id, 'assigned'
from public.permissions where code = 'asset.view'
on conflict (role_id, permission_id, scope) do nothing;

insert into public.departments (id, code, name, active, manager_id) values
  ('92000000-0000-0000-0000-000000000001', 'asset_v2_active', 'Asset V2 Active', true, null),
  ('92000000-0000-0000-0000-000000000002', 'asset_v2_other', 'Asset V2 Other', true, null),
  ('92000000-0000-0000-0000-000000000003', 'asset_v2_inactive', 'Asset V2 Inactive', false, null)
on conflict (id) do update set active = excluded.active;

insert into public.staff_users (id, full_name, email, password_hash, role_id, department_id, active)
values
  ('93000000-0000-0000-0000-000000000001', 'Asset V2 Admin', 'asset-v2-admin@test.invalid', 'fixture', '91000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', true),
  ('93000000-0000-0000-0000-000000000002', 'Asset V2 Employee', 'asset-v2-employee@test.invalid', 'fixture', '91000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000001', true),
  ('93000000-0000-0000-0000-000000000003', 'Asset V2 Other Employee', 'asset-v2-other@test.invalid', 'fixture', '91000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000002', true)
on conflict (id) do update set active = true, department_id = excluded.department_id;

insert into public.assets (id, asset_code, asset_name, category, status)
values ('94000000-0000-0000-0000-000000000001', 'ASSET-V2-001', 'Asset V2 Fixture', 'fixture', 'available')
on conflict (id) do update set status = 'available', assigned_department_id = null;

select public.api_asset_assign(
  '93000000-0000-0000-0000-000000000001',
  '94000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000002',
  null,
  'initial assignment'
);

do $assert$
begin
  if not exists (select 1 from public.asset_assignments where asset_id = '94000000-0000-0000-0000-000000000001' and status = 'active' and department_id = '92000000-0000-0000-0000-000000000001' and assignee_id = '93000000-0000-0000-0000-000000000002') then
    raise exception 'initial assignment missing';
  end if;
  if (select assigned_department_id from public.assets where id = '94000000-0000-0000-0000-000000000001') <> '92000000-0000-0000-0000-000000000001' then
    raise exception 'compatibility projection missing';
  end if;
end
$assert$;

select pg_temp.expect_error('mismatched assignee', $$select public.api_asset_transfer('93000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000002', '93000000-0000-0000-0000-000000000002', null, null)$$, array['22023']);
select pg_temp.expect_error('inactive department', $$select public.api_asset_transfer('93000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000003', null, null, null)$$, array['22023']);
select pg_temp.expect_error('duplicate initial assignment', $$select public.api_asset_assign('93000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', null, null, null)$$, array['23505']);

select public.api_asset_transfer(
  '93000000-0000-0000-0000-000000000001',
  '94000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000002',
  '93000000-0000-0000-0000-000000000003',
  null,
  'transferred assignment'
);

do $assert$
begin
  if (select assigned_department_id from public.assets where id = '94000000-0000-0000-0000-000000000001') <> '92000000-0000-0000-0000-000000000002' then
    raise exception 'transfer projection missing';
  end if;
end
$assert$;

select public.api_asset_return('93000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000001', 'returned fixture');

do $assert$
declare
  v_history integer;
begin
  select count(*) into v_history from public.asset_assignments where asset_id = '94000000-0000-0000-0000-000000000001';
  if v_history <> 2 then raise exception 'assignment history count mismatch'; end if;
  if exists (select 1 from public.asset_assignments where asset_id = '94000000-0000-0000-0000-000000000001' and status = 'active' and returned_at is null) then raise exception 'active assignment remains after return'; end if;
  if (select assigned_department_id from public.assets where id = '94000000-0000-0000-0000-000000000001') is not null then raise exception 'projection not cleared'; end if;
  if (select status from public.assets where id = '94000000-0000-0000-0000-000000000001') <> 'available' then raise exception 'asset status not returned'; end if;
end
$assert$;

select pg_temp.expect_error('closed history update', $$update public.asset_assignments set handover_note = 'tampered' where asset_id = '94000000-0000-0000-0000-000000000001' and status = 'returned'$$, array['42501']);
select pg_temp.expect_error('closed history delete', $$delete from public.asset_assignments where asset_id = '94000000-0000-0000-0000-000000000001'$$, array['42501']);

rollback;
select 'ASSET_MANAGEMENT_V2_REHEARSAL_PASS' as result;

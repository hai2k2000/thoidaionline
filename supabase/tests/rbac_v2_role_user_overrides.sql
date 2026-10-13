begin;

insert into public.departments(id, code, name, active)
values ('00000000-0000-0000-0000-000000000001', 'RBAC_TEST', 'RBAC Test', true)
on conflict (id) do nothing;

insert into public.roles(id, code, name, level, active)
values
  ('00000000-0000-0000-0000-000000000010', 'rbac_test_manager', 'RBAC Test Manager', 100, true),
  ('00000000-0000-0000-0000-000000000011', 'rbac_test_staff', 'RBAC Test Staff', 1, true),
  ('00000000-0000-0000-0000-000000000012', 'rbac_test_inactive', 'RBAC Test Inactive', 1, false)
on conflict (id) do update set active = excluded.active;

insert into public.staff_users(id, full_name, password, role_id, department_id, active)
values
  ('00000000-0000-0000-0000-000000000020', 'RBAC Manager', 'test', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0000-000000000021', 'RBAC Staff', 'test', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0000-000000000022', 'RBAC Inactive Role', 'test', '00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0000-000000000023', 'RBAC Inactive User', 'test', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', false)
on conflict (id) do update set role_id = excluded.role_id, active = excluded.active;

insert into public.role_permission_grants(role_id, permission_id, scope)
select '00000000-0000-0000-0000-000000000010', id, 'all'
from public.permissions
where code = 'permission.manage'
on conflict do nothing;
insert into public.role_permission_grants(role_id, permission_id, scope)
select '00000000-0000-0000-0000-000000000011', id, 'all'
from public.permissions
where code = 'asset.manage'
on conflict do nothing;

do $$
declare
  v_permission_id uuid;
  v_effective record;
  v_result jsonb;
begin
  select id into v_permission_id from public.permissions where code = 'asset.manage';
  v_result := public.api_set_user_permission_override('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000021', 'asset.manage', 'deny', 'all');
  if public.asset_actor_can_manage('00000000-0000-0000-0000-000000000021') then raise exception 'deny did not reach asset authorization'; end if;
  select * into v_effective from public.api_list_effective_permissions('00000000-0000-0000-0000-000000000021') where permission_code = 'asset.manage';
  if v_effective.source <> 'user_deny' or cardinality(v_effective.effective_scopes) <> 0 then raise exception 'deny precedence failed'; end if;

  perform public.api_set_user_permission_override('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000022', 'asset.manage', 'allow', 'all');
  select * into v_effective from public.api_list_effective_permissions('00000000-0000-0000-0000-000000000022') where permission_code = 'asset.manage';
  if v_effective.source <> 'user_allow' or cardinality(v_effective.effective_scopes) <> 1 then raise exception 'inactive role direct allow failed'; end if;

end $$;

do $$
begin
  begin
    perform public.api_set_user_permission_override('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000023', 'asset.manage', 'allow', 'all');
    raise exception 'inactive allow accepted';
  exception when sqlstate '22023' then null;
  end;
end $$;

do $$
begin
  if not exists (
    select 1 from public.api_list_effective_permissions('00000000-0000-0000-0000-000000000023')
    where permission_code = 'asset.manage' and cardinality(effective_scopes) = 0 and source = 'none'
  ) then
    raise exception 'inactive user has effective permission';
  end if;
end $$;

do $$
begin
  begin
    perform public.rbac_v2_assert_legacy_rollback_compatible();
    raise exception 'rollback gate accepted deny rows';
  exception when sqlstate '55006' then null;
  end;
end $$;

rollback;

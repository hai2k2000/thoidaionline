do $$
declare
  v_permissions integer;
  v_grants integer;
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='permissions') then
    raise exception 'permissions table missing';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='role_permission_grants') then
    raise exception 'role_permission_grants table missing';
  end if;
  if not exists (select 1 from pg_constraint where conname='role_permission_grants_scope_check') then
    raise exception 'scope constraint missing';
  end if;
  if not exists (select 1 from pg_constraint where conname='role_permission_grants_unique') then
    raise exception 'grant uniqueness constraint missing';
  end if;
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='role_permission_grants_permission_idx') then
    raise exception 'permission index missing';
  end if;
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='role_permission_grants_role_scope_idx') then
    raise exception 'role scope index missing';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.permissions'::regclass) then
    raise exception 'permissions RLS disabled';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.role_permission_grants'::regclass) then
    raise exception 'grant RLS disabled';
  end if;
  if has_table_privilege('anon','public.permissions','SELECT')
     or has_table_privilege('authenticated','public.permissions','SELECT')
     or has_table_privilege('anon','public.role_permission_grants','SELECT')
     or has_table_privilege('authenticated','public.role_permission_grants','SELECT') then
    raise exception 'browser table access remains';
  end if;
  select count(*) into v_permissions from public.permissions;
  select count(*) into v_grants from public.role_permission_grants;
  if v_permissions < 1 or v_grants < 1 then
    raise exception 'RBAC seed is empty';
  end if;
end $$;

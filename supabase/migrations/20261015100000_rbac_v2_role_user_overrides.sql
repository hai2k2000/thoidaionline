begin;

alter table public.user_permission_grants
  add column if not exists effect text not null default 'allow';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_permission_grants'::regclass
      and conname = 'user_permission_grants_effect_check'
  ) then
    alter table public.user_permission_grants
      add constraint user_permission_grants_effect_check
      check (effect in ('allow', 'deny'));
  end if;
end
$$;

create or replace function public.api_list_effective_permissions(p_actor_id uuid)
returns table(
  permission_code text,
  permission_name text,
  module text,
  description text,
  role_scopes text[],
  user_effect text,
  user_scope text,
  effective_scopes text[],
  source text,
  actor_active boolean,
  role_active boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if p_actor_id is null or not exists (select 1 from public.staff_users where id = p_actor_id) then
    raise exception 'Invalid actor.' using errcode = '42501';
  end if;

  return query
  with actor as (
    select u.id, u.active as actor_active, r.active as role_active, r.id as role_id
    from public.staff_users u
    left join public.roles r on r.id = u.role_id
    where u.id = p_actor_id
  ),
  role_grants as (
    select g.permission_id, array_agg(distinct g.scope order by g.scope)::text[] as scopes
    from public.role_permission_grants g
    join actor a on a.role_id = g.role_id and a.role_active = true
    group by g.permission_id
  ),
  overrides as (
    select g.permission_id, g.effect, g.scope
    from public.user_permission_grants g
    where g.user_id = p_actor_id
  )
  select
    p.code,
    p.name,
    p.module,
    p.description,
    coalesce(rg.scopes, '{}'::text[]),
    ov.effect,
    ov.scope,
    case
      when a.actor_active is distinct from true then '{}'::text[]
      when ov.effect = 'deny' then '{}'::text[]
      when ov.effect = 'allow' then array[ov.scope]::text[]
      when a.role_active = true then coalesce(rg.scopes, '{}'::text[])
      else '{}'::text[]
    end,
    case
      when a.actor_active is distinct from true then 'none'
      when ov.effect = 'deny' then 'user_deny'
      when ov.effect = 'allow' then 'user_allow'
      when a.role_active = true and cardinality(coalesce(rg.scopes, '{}'::text[])) > 0 then 'role'
      else 'none'
    end,
    coalesce(a.actor_active, false),
    coalesce(a.role_active, false)
  from public.permissions p
  cross join actor a
  left join role_grants rg on rg.permission_id = p.id
  left join overrides ov on ov.permission_id = p.id
  order by p.module, p.code;
end
$function$;

create or replace function public.api_list_role_permission_grants(p_actor_id uuid)
returns table(permission_code text, scope text)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if p_actor_id is null or not exists (
    select 1 from public.staff_users u where u.id = p_actor_id and u.active = true
  ) then
    raise exception 'Invalid actor.' using errcode = '42501';
  end if;
  return query
  select e.permission_code, scope
  from public.api_list_effective_permissions(p_actor_id) e
  cross join lateral unnest(e.effective_scopes) as scope
  order by e.permission_code, scope;
end
$function$;

create or replace function public.rbac_v2_assert_manager(p_actor_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if not exists (
    select 1
    from public.api_list_effective_permissions(p_actor_id)
    where permission_code = 'permission.manage'
      and cardinality(effective_scopes) > 0
  ) then
    raise exception 'Forbidden.' using errcode = '42501';
  end if;
end
$function$;

create or replace function public.rbac_v2_assert_manager_survives()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if not exists (
    select 1
    from public.staff_users u
    where u.active = true
      and exists (
        select 1
        from public.api_list_effective_permissions(u.id)
        where permission_code = 'permission.manage'
          and cardinality(effective_scopes) > 0
      )
  ) then
    raise exception 'Cannot remove the last permission manager.' using errcode = '42501';
  end if;
end
$function$;

-- A legacy application cannot safely downgrade while deny rows exist or while
-- a narrow allow override would be widened by the legacy role/user union.
-- Rollback tooling must call this gate before activating an older resolver.
create or replace function public.rbac_v2_assert_legacy_rollback_compatible()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if exists (select 1 from public.user_permission_grants where effect = 'deny') then
    raise exception 'Rollback compatibility gate failed: explicit deny rows exist.' using errcode = '55006';
  end if;
  if exists (
    select 1
    from public.staff_users u
    join public.roles r on r.id = u.role_id and r.active = true
    join public.role_permission_grants rg on rg.role_id = r.id
    join public.permissions p on p.id = rg.permission_id
    join public.user_permission_grants ug
      on ug.user_id = u.id
     and ug.permission_id = rg.permission_id
     and ug.effect = 'allow'
    where u.active = true
      and not (
        ug.scope = rg.scope
        or ug.scope = 'all'
      )
  ) then
    raise exception 'Rollback compatibility gate failed: legacy union would widen a narrow allow override.' using errcode = '55006';
  end if;
end
$function$;

create or replace function public.rbac_v2_has_effective_scope(
  p_actor_id uuid,
  p_permission_code text,
  p_scopes text[]
) returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.api_list_effective_permissions(p_actor_id) e
    cross join lateral unnest(e.effective_scopes) as granted_scope(scope)
    where e.permission_code = p_permission_code
      and granted_scope.scope = any(p_scopes)
  );
$function$;

create or replace function public.rbac_v2_scope_supported(p_permission_code text, p_scope text)
returns boolean
language sql
immutable
as $function$
  select case
    when p_scope is null then false
    when p_permission_code in ('task.quick_report.create', 'attendance.view_self', 'leave.view_self', 'schedule.view_self') then p_scope in ('self', 'all')
    when p_permission_code in ('task.create', 'task.edit_all', 'task.review', 'task.score', 'task.evaluate.step1', 'task.evaluate.step2', 'staff.manage', 'permission.manage', 'evaluation.rubric.manage', 'attendance.view_all', 'asset.manage', 'journalism.metadata.update', 'journalism.publication.manage', 'journalism.publication.verify') then p_scope = 'all'
    when p_permission_code = 'task.assign' then p_scope in ('department', 'all')
    when p_permission_code = 'asset.view' then p_scope in ('assigned', 'department', 'all')
    else p_scope in ('self', 'assigned', 'department', 'all')
  end;
$function$;

create or replace function public.rbac_v2_effective_summary(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'permissionCode', e.permission_code,
    'roleScopes', e.role_scopes,
    'userEffect', e.user_effect,
    'userScope', e.user_scope,
    'effectiveScopes', e.effective_scopes,
    'source', e.source
  ) order by e.permission_code), '[]'::jsonb)
  from public.api_list_effective_permissions(p_user_id) e;
$function$;

create or replace function public.asset_actor_can_manage(p_actor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select public.rbac_v2_has_effective_scope(p_actor_id, 'asset.manage', array['all']::text[]);
$function$;

do $migration$
begin
  if to_regprocedure('public.api_create_quick_report_v1_legacy(uuid,uuid,jsonb)') is null
     and to_regprocedure('public.api_create_quick_report_v1(uuid,uuid,jsonb)') is not null then
    alter function public.api_create_quick_report_v1(uuid, uuid, jsonb)
      rename to api_create_quick_report_v1_legacy;
  end if;
end
$migration$;

create or replace function public.api_create_quick_report_v1(
  p_actor_id uuid,
  p_request_id uuid,
  p_rows jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if not public.rbac_v2_has_effective_scope(p_actor_id, 'task.quick_report.create', array['self', 'all']::text[]) then
    raise exception 'Quick report permission denied.' using errcode = '42501';
  end if;
  return public.api_create_quick_report_v1_legacy(p_actor_id, p_request_id, p_rows);
end
$function$;

do $migration$
begin
  if to_regprocedure('public.api_set_quick_report_permission_legacy(uuid,uuid,boolean)') is null
     and to_regprocedure('public.api_set_quick_report_permission(uuid,uuid,boolean)') is not null then
    alter function public.api_set_quick_report_permission(uuid, uuid, boolean) rename to api_set_quick_report_permission_legacy;
  end if;
  if to_regprocedure('public.api_set_user_quick_report_permission_legacy(uuid,uuid,boolean)') is null
     and to_regprocedure('public.api_set_user_quick_report_permission(uuid,uuid,boolean)') is not null then
    alter function public.api_set_user_quick_report_permission(uuid, uuid, boolean) rename to api_set_user_quick_report_permission_legacy;
  end if;
  if to_regprocedure('public.api_set_asset_manage_permission_legacy(uuid,uuid,boolean)') is null
     and to_regprocedure('public.api_set_asset_manage_permission(uuid,uuid,boolean)') is not null then
    alter function public.api_set_asset_manage_permission(uuid, uuid, boolean) rename to api_set_asset_manage_permission_legacy;
  end if;
  if to_regprocedure('public.api_set_asset_manage_user_permission_legacy(uuid,uuid,boolean)') is null
     and to_regprocedure('public.api_set_asset_manage_user_permission(uuid,uuid,boolean)') is not null then
    alter function public.api_set_asset_manage_user_permission(uuid, uuid, boolean) rename to api_set_asset_manage_user_permission_legacy;
  end if;
end
$migration$;

create or replace function public.api_set_quick_report_permission(p_actor_id uuid, p_role_id uuid, p_granted boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $function$
begin
  perform public.rbac_v2_assert_manager(p_actor_id);
  return public.api_set_quick_report_permission_legacy(p_actor_id, p_role_id, p_granted);
end
$function$;

create or replace function public.api_set_user_quick_report_permission(p_actor_id uuid, p_user_id uuid, p_granted boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $function$
begin
  perform public.rbac_v2_assert_manager(p_actor_id);
  return public.api_set_user_quick_report_permission_legacy(p_actor_id, p_user_id, p_granted);
end
$function$;

create or replace function public.api_set_asset_manage_permission(p_actor_id uuid, p_role_id uuid, p_granted boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $function$
begin
  perform public.rbac_v2_assert_manager(p_actor_id);
  return public.api_set_asset_manage_permission_legacy(p_actor_id, p_role_id, p_granted);
end
$function$;

create or replace function public.api_set_asset_manage_user_permission(p_actor_id uuid, p_user_id uuid, p_granted boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $function$
begin
  perform public.rbac_v2_assert_manager(p_actor_id);
  return public.api_set_asset_manage_user_permission_legacy(p_actor_id, p_user_id, p_granted);
end
$function$;

create or replace function public.api_replace_role_permissions(
  p_actor_id uuid,
  p_role_id uuid,
  p_grants jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_role_id uuid;
  v_old jsonb;
  v_new jsonb := '[]'::jsonb;
  v_item jsonb;
  v_code text;
  v_scope text;
  v_permission_id uuid;
  v_audit record;
  v_effective_users jsonb;
begin
  if p_actor_id is null or p_role_id is null or jsonb_typeof(p_grants) <> 'array' then
    raise exception 'Invalid role permission payload.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('rbac.permission.manage', 0));
  perform public.rbac_v2_assert_manager(p_actor_id);
  perform 1 from public.roles where id = p_role_id for update;
  if not found then raise exception 'Role not found.' using errcode = 'P0002'; end if;
  perform 1 from public.staff_users where active = true for update;
  select role_id into v_actor_role_id from public.staff_users where id = p_actor_id and active = true;
  if not found then raise exception 'Invalid actor.' using errcode = '42501'; end if;
  if not exists (select 1 from public.roles where id = p_role_id and active = true) then
    raise exception 'Role not found.' using errcode = 'P0002';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('permissionCode', old_grant.code, 'scopes', old_grant.scopes) order by old_grant.code), '[]'::jsonb)
    into v_old
  from (
    select p.code, jsonb_agg(g.scope order by g.scope) as scopes
    from public.role_permission_grants g
    join public.permissions p on p.id = g.permission_id
    where g.role_id = p_role_id
    group by p.code
  ) as old_grant;

  for v_item in select value from jsonb_array_elements(p_grants) loop
    if jsonb_typeof(v_item) <> 'object' or jsonb_typeof(v_item->'permissionCode') <> 'string' or jsonb_typeof(v_item->'scopes') <> 'array' then
      raise exception 'Invalid role permission entry.' using errcode = '22023';
    end if;
    v_code := v_item->>'permissionCode';
    if not exists (select 1 from public.permissions where code = v_code) then
      raise exception 'Permission not found.' using errcode = 'P0002';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_new) existing
      where existing->>'permissionCode' = v_code
    ) then
      raise exception 'Duplicate permission code.' using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_array_elements_text(v_item->'scopes') s where not public.rbac_v2_scope_supported(v_code, s)) then
      raise exception 'Unsupported permission scope.' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(v_item->'scopes') s
      group by s having count(*) > 1
    ) then
      raise exception 'Duplicate permission scope.' using errcode = '22023';
    end if;
    if p_role_id = v_actor_role_id then
      for v_scope in select value from jsonb_array_elements_text(v_item->'scopes') loop
        if not exists (
          select 1
          from jsonb_array_elements(v_old) old_item
          cross join lateral jsonb_array_elements_text(old_item->'scopes') old_scope(scope)
          where old_item->>'permissionCode' = v_code
            and old_scope.scope = v_scope
        ) and not exists (
          select 1
          from jsonb_array_elements(v_old) old_item
          cross join lateral jsonb_array_elements_text(old_item->'scopes') old_scope(scope)
          where old_item->>'permissionCode' = v_code
            and old_scope.scope = 'all'
        ) then
          raise exception 'Self elevation is not allowed.' using errcode = '42501';
        end if;
      end loop;
    end if;
    v_new := v_new || jsonb_build_array(jsonb_build_object(
      'permissionCode', v_code,
      'scopes', coalesce((
        select jsonb_agg(scope order by scope)
        from jsonb_array_elements_text(v_item->'scopes') as scopes(scope)
      ), '[]'::jsonb)
    ));
  end loop;

  select coalesce(jsonb_agg(item order by item->>'permissionCode'), '[]'::jsonb)
    into v_new
    from jsonb_array_elements(v_new) as entries(item);

  if v_old = v_new then
    select coalesce(jsonb_agg(jsonb_build_object('userId', u.id, 'permissions', public.rbac_v2_effective_summary(u.id)) order by u.id), '[]'::jsonb)
      into v_effective_users
      from public.staff_users u where u.role_id = p_role_id;
    return jsonb_build_object('roleId', p_role_id, 'changed', false, 'grants', v_new, 'effectiveUsers', v_effective_users);
  end if;

  delete from public.role_permission_grants where role_id = p_role_id;
  for v_item in select value from jsonb_array_elements(v_new) loop
    select id into v_permission_id from public.permissions where code = v_item->>'permissionCode';
    for v_scope in select value from jsonb_array_elements_text(v_item->'scopes') loop
      insert into public.role_permission_grants(role_id, permission_id, scope)
      values (p_role_id, v_permission_id, v_scope);
    end loop;
  end loop;
  perform public.rbac_v2_assert_manager_survives();
  for v_audit in
    with codes as (
      select item->>'permissionCode' as code from jsonb_array_elements(v_old) item
      union
      select item->>'permissionCode' as code from jsonb_array_elements(v_new) item
    )
    select c.code,
      coalesce((select item->'scopes' from jsonb_array_elements(v_old) item where item->>'permissionCode' = c.code), '[]'::jsonb) as old_scopes,
      coalesce((select item->'scopes' from jsonb_array_elements(v_new) item where item->>'permissionCode' = c.code), '[]'::jsonb) as new_scopes
    from codes c
  loop
    if v_audit.old_scopes is distinct from v_audit.new_scopes then
    insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data)
      values (p_actor_id, 'admin', 'role_permission_grant', p_role_id, 'replace_permission', jsonb_build_object('permission_code', v_audit.code, 'old_scopes', v_audit.old_scopes, 'new_scopes', v_audit.new_scopes));
    end if;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('userId', u.id, 'permissions', public.rbac_v2_effective_summary(u.id)) order by u.id), '[]'::jsonb)
    into v_effective_users
    from public.staff_users u where u.role_id = p_role_id;
  return jsonb_build_object('roleId', p_role_id, 'changed', true, 'grants', v_new, 'effectiveUsers', v_effective_users);
end
$function$;

create or replace function public.api_set_user_permission_override(
  p_actor_id uuid,
  p_user_id uuid,
  p_permission_code text,
  p_effect text,
  p_scope text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_permission_id uuid;
  v_old jsonb;
  v_new jsonb;
begin
  if p_actor_id is null or p_user_id is null or p_permission_code is null or p_effect not in ('allow','deny') or not public.rbac_v2_scope_supported(p_permission_code, p_scope) then
    raise exception 'Invalid permission override.' using errcode = '22023';
  end if;
  if p_actor_id = p_user_id then raise exception 'Self override is not allowed.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('rbac.permission.manage', 0));
  perform public.rbac_v2_assert_manager(p_actor_id);
  perform 1 from public.staff_users where id = p_user_id for update;
  if not found then raise exception 'User not found.' using errcode = 'P0002'; end if;
  perform 1 from public.staff_users where active = true for update;
  if p_effect = 'allow' and not exists (select 1 from public.staff_users where id = p_user_id and active = true) then raise exception 'Inactive user cannot receive permission.' using errcode = '22023'; end if;
  select id into v_permission_id from public.permissions where code = p_permission_code;
  if v_permission_id is null then raise exception 'Permission not found.' using errcode = 'P0002'; end if;
  select jsonb_build_object('effect', effect, 'scope', scope) into v_old from public.user_permission_grants where user_id = p_user_id and permission_id = v_permission_id;
  v_new := jsonb_build_object('effect', p_effect, 'scope', p_scope);
  if v_old = v_new then
    return jsonb_build_object('userId', p_user_id, 'permissionCode', p_permission_code, 'changed', false, 'effect', p_effect, 'scope', p_scope, 'effectivePermissions', public.rbac_v2_effective_summary(p_user_id));
  end if;
  insert into public.user_permission_grants(user_id, permission_id, scope, effect, created_by)
  values (p_user_id, v_permission_id, p_scope, p_effect, p_actor_id)
  on conflict (user_id, permission_id) do update set scope = excluded.scope, effect = excluded.effect, updated_at = now();
  perform public.rbac_v2_assert_manager_survives();
  if v_old is distinct from v_new then
    insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data)
    values (p_actor_id, 'admin', 'user_permission_grant', p_user_id, 'set_permission_override', jsonb_build_object('permission_code', p_permission_code, 'old', v_old, 'new', v_new));
  end if;
  return jsonb_build_object('userId', p_user_id, 'permissionCode', p_permission_code, 'changed', true, 'effect', p_effect, 'scope', p_scope, 'effectivePermissions', public.rbac_v2_effective_summary(p_user_id));
end
$function$;

create or replace function public.api_restore_user_permission_inheritance(p_actor_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_old jsonb;
  v_changed integer;
begin
  if p_actor_id is null or p_user_id is null then raise exception 'Invalid inheritance restore.' using errcode = '22023'; end if;
  if p_actor_id = p_user_id then raise exception 'Self override is not allowed.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('rbac.permission.manage', 0));
  perform public.rbac_v2_assert_manager(p_actor_id);
  perform 1 from public.staff_users where id = p_user_id for update;
  if not found then raise exception 'User not found.' using errcode = 'P0002'; end if;
  perform 1 from public.staff_users where active = true for update;
  select coalesce(jsonb_agg(jsonb_build_object('permissionId', permission_id, 'effect', effect, 'scope', scope) order by permission_id), '[]'::jsonb) into v_old from public.user_permission_grants where user_id = p_user_id;
  delete from public.user_permission_grants where user_id = p_user_id;
  get diagnostics v_changed = row_count;
  perform public.rbac_v2_assert_manager_survives();
  if v_changed > 0 then
    insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data)
    values (p_actor_id, 'admin', 'user_permission_grant', p_user_id, 'restore_permission_inheritance', jsonb_build_object('old', v_old, 'changed', v_changed));
  end if;
  return jsonb_build_object('userId', p_user_id, 'changed', v_changed, 'effectivePermissions', public.rbac_v2_effective_summary(p_user_id));
end
$function$;

create or replace function public.api_clear_user_permission_override(
  p_actor_id uuid,
  p_user_id uuid,
  p_permission_code text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_permission_id uuid;
  v_old jsonb;
  v_changed integer;
begin
  if p_actor_id is null or p_user_id is null or p_permission_code is null then
    raise exception 'Invalid permission inheritance restore.' using errcode = '22023';
  end if;
  if p_actor_id = p_user_id then
    raise exception 'Self override is not allowed.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('rbac.permission.manage', 0));
  perform public.rbac_v2_assert_manager(p_actor_id);
  perform 1 from public.staff_users where id = p_user_id for update;
  if not found then raise exception 'User not found.' using errcode = 'P0002'; end if;
  select id into v_permission_id from public.permissions where code = p_permission_code;
  if v_permission_id is null then raise exception 'Permission not found.' using errcode = 'P0002'; end if;
  select jsonb_build_object('effect', effect, 'scope', scope)
    into v_old
    from public.user_permission_grants
   where user_id = p_user_id and permission_id = v_permission_id;
  delete from public.user_permission_grants
   where user_id = p_user_id and permission_id = v_permission_id;
  get diagnostics v_changed = row_count;
  perform 1 from public.staff_users where active = true for update;
  perform public.rbac_v2_assert_manager_survives();
  if v_changed > 0 then
    insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data)
    values (p_actor_id, 'admin', 'user_permission_grant', p_user_id, 'clear_permission_override', jsonb_build_object('permission_code', p_permission_code, 'old', v_old));
  end if;
  return jsonb_build_object('userId', p_user_id, 'permissionCode', p_permission_code, 'changed', v_changed > 0, 'effectivePermissions', public.rbac_v2_effective_summary(p_user_id));
end
$function$;

revoke all on function public.api_list_effective_permissions(uuid) from public, anon, authenticated;
grant execute on function public.api_list_effective_permissions(uuid) to service_role;
revoke all on function public.rbac_v2_has_effective_scope(uuid, text, text[]) from public, anon, authenticated;
grant execute on function public.rbac_v2_has_effective_scope(uuid, text, text[]) to service_role;
revoke all on function public.rbac_v2_effective_summary(uuid) from public, anon, authenticated;
revoke all on function public.rbac_v2_scope_supported(text, text) from public, anon, authenticated;
revoke all on function public.asset_actor_can_manage(uuid) from public, anon, authenticated;
grant execute on function public.asset_actor_can_manage(uuid) to service_role;
revoke all on function public.api_list_role_permission_grants(uuid) from public, anon, authenticated;
grant execute on function public.api_list_role_permission_grants(uuid) to service_role;
revoke all on function public.rbac_v2_assert_manager(uuid) from public, anon, authenticated;
revoke all on function public.rbac_v2_assert_manager_survives() from public, anon, authenticated;
revoke all on function public.rbac_v2_assert_legacy_rollback_compatible() from public, anon, authenticated;
grant execute on function public.rbac_v2_assert_legacy_rollback_compatible() to service_role;
revoke all on function public.api_replace_role_permissions(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.api_replace_role_permissions(uuid, uuid, jsonb) to service_role;
revoke all on function public.api_set_user_permission_override(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.api_set_user_permission_override(uuid, uuid, text, text, text) to service_role;
revoke all on function public.api_restore_user_permission_inheritance(uuid, uuid) from public, anon, authenticated;
grant execute on function public.api_restore_user_permission_inheritance(uuid, uuid) to service_role;
revoke all on function public.api_clear_user_permission_override(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.api_clear_user_permission_override(uuid, uuid, text) to service_role;
revoke all on function public.api_create_quick_report_v1_legacy(uuid, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.api_create_quick_report_v1(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.api_create_quick_report_v1(uuid, uuid, jsonb) to service_role;
revoke all on function public.api_set_quick_report_permission(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.api_set_quick_report_permission(uuid, uuid, boolean) to service_role;
revoke all on function public.api_set_user_quick_report_permission(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.api_set_user_quick_report_permission(uuid, uuid, boolean) to service_role;
revoke all on function public.api_set_asset_manage_permission(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.api_set_asset_manage_permission(uuid, uuid, boolean) to service_role;
revoke all on function public.api_set_asset_manage_user_permission(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.api_set_asset_manage_user_permission(uuid, uuid, boolean) to service_role;

alter function public.api_list_effective_permissions(uuid) owner to postgres;
alter function public.api_replace_role_permissions(uuid, uuid, jsonb) owner to postgres;
alter function public.api_set_user_permission_override(uuid, uuid, text, text, text) owner to postgres;
alter function public.api_restore_user_permission_inheritance(uuid, uuid) owner to postgres;
alter function public.api_clear_user_permission_override(uuid, uuid, text) owner to postgres;
alter function public.api_create_quick_report_v1(uuid, uuid, jsonb) owner to postgres;

notify pgrst, 'reload schema';
commit;

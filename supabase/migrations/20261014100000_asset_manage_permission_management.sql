begin;

update public.permissions
set name = 'Quản lý tài sản', module = 'assets', description = 'Tạo, sửa và quản lý vòng đời tài sản toàn cơ quan.', updated_at = now()
where code = 'asset.manage';

create or replace function public.api_set_asset_manage_permission(p_actor_id uuid, p_role_id uuid, p_granted boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $function$
declare v_permission_id uuid; v_changed integer := 0;
begin
  if p_actor_id is null or p_role_id is null or p_granted is null then raise exception 'Invalid permission mutation.' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.staff_users u join public.roles r on r.id = u.role_id and r.active = true join public.role_permission_grants g on g.role_id = r.id join public.permissions p on p.id = g.permission_id and p.code = 'permission.manage' where u.id = p_actor_id and u.active = true
    union all
    select 1 from public.staff_users u join public.user_permission_grants g on g.user_id = u.id join public.permissions p on p.id = g.permission_id and p.code = 'permission.manage' where u.id = p_actor_id and u.active = true
  ) then raise exception 'Forbidden.' using errcode = '42501'; end if;
  if not exists (select 1 from public.roles where id = p_role_id and active = true) then raise exception 'Role not found.' using errcode = 'P0002'; end if;
  select id into v_permission_id from public.permissions where code = 'asset.manage';
  if v_permission_id is null then raise exception 'Permission not found.' using errcode = 'P0002'; end if;
  if p_granted then
    insert into public.role_permission_grants(role_id, permission_id, scope) values (p_role_id, v_permission_id, 'all') on conflict (role_id, permission_id, scope) do nothing;
    get diagnostics v_changed = row_count;
  else
    delete from public.role_permission_grants where role_id = p_role_id and permission_id = v_permission_id;
    get diagnostics v_changed = row_count;
  end if;
  if v_changed > 0 then insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data) values (p_actor_id, 'admin', 'role_permission_grant', p_role_id, case when p_granted then 'grant_permission' else 'revoke_permission' end, jsonb_build_object('permission_code', 'asset.manage', 'role_id', p_role_id, 'scope', 'all', 'changed', v_changed)); end if;
  return jsonb_build_object('roleId', p_role_id, 'permissionCode', 'asset.manage', 'granted', p_granted, 'changed', v_changed);
end
$function$;

create or replace function public.api_set_asset_manage_user_permission(p_actor_id uuid, p_user_id uuid, p_granted boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $function$
declare v_permission_id uuid; v_changed integer := 0;
begin
  if p_actor_id is null or p_user_id is null or p_granted is null then raise exception 'Invalid permission mutation.' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.staff_users u join public.roles r on r.id = u.role_id and r.active = true join public.role_permission_grants g on g.role_id = r.id join public.permissions p on p.id = g.permission_id and p.code = 'permission.manage' where u.id = p_actor_id and u.active = true
    union all
    select 1 from public.staff_users u join public.user_permission_grants g on g.user_id = u.id join public.permissions p on p.id = g.permission_id and p.code = 'permission.manage' where u.id = p_actor_id and u.active = true
  ) then raise exception 'Forbidden.' using errcode = '42501'; end if;
  if not exists (select 1 from public.staff_users where id = p_user_id and active = true) then raise exception 'User not found.' using errcode = 'P0002'; end if;
  select id into v_permission_id from public.permissions where code = 'asset.manage';
  if v_permission_id is null then raise exception 'Permission not found.' using errcode = 'P0002'; end if;
  if p_granted then
    insert into public.user_permission_grants(user_id, permission_id, scope, created_by) values (p_user_id, v_permission_id, 'all', p_actor_id) on conflict (user_id, permission_id) do nothing;
    get diagnostics v_changed = row_count;
  else
    delete from public.user_permission_grants where user_id = p_user_id and permission_id = v_permission_id;
    get diagnostics v_changed = row_count;
  end if;
  if v_changed > 0 then insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data) values (p_actor_id, 'admin', 'user_permission_grant', p_user_id, case when p_granted then 'grant_permission' else 'revoke_permission' end, jsonb_build_object('permission_code', 'asset.manage', 'target_user_id', p_user_id, 'scope', 'all', 'changed', v_changed)); end if;
  return jsonb_build_object('userId', p_user_id, 'permissionCode', 'asset.manage', 'granted', p_granted, 'changed', v_changed);
end
$function$;

revoke all on function public.api_set_asset_manage_permission(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.api_set_asset_manage_permission(uuid, uuid, boolean) to service_role;
alter function public.api_set_asset_manage_permission(uuid, uuid, boolean) owner to postgres;
revoke all on function public.api_set_asset_manage_user_permission(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.api_set_asset_manage_user_permission(uuid, uuid, boolean) to service_role;
alter function public.api_set_asset_manage_user_permission(uuid, uuid, boolean) owner to postgres;
notify pgrst, 'reload schema';
commit;

begin;

update public.permissions
set name = 'Tạo/Báo cáo công việc phát sinh',
    module = 'task',
    description = 'Cho phép tạo công việc phát sinh không cần phê duyệt, bao gồm tạo một việc hoặc nhiều việc cùng lúc.',
    updated_at = now()
where code = 'task.quick_report.create';

create or replace function public.api_set_quick_report_permission(
  p_actor_id uuid,
  p_role_id uuid,
  p_granted boolean
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $function$
declare
  v_permission_id uuid;
  v_changed integer := 0;
begin
  if p_actor_id is null or p_role_id is null or p_granted is null then
    raise exception 'Invalid permission mutation.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.staff_users u
    join public.roles r on r.id = u.role_id
    join public.role_permission_grants g on g.role_id = r.id
    join public.permissions p on p.id = g.permission_id
    where u.id = p_actor_id
      and u.active = true
      and r.active = true
      and p.code = 'permission.manage'
      and g.scope in ('all', 'self')
  ) then
    raise exception 'Forbidden.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.roles where id = p_role_id) then
    raise exception 'Role not found.' using errcode = 'P0002';
  end if;

  select id into v_permission_id
  from public.permissions
  where code = 'task.quick_report.create';
  if v_permission_id is null then
    raise exception 'Permission not found.' using errcode = 'P0002';
  end if;

  if p_granted then
    insert into public.role_permission_grants(role_id, permission_id, scope)
    values (p_role_id, v_permission_id, 'all')
    on conflict (role_id, permission_id, scope) do nothing;
    get diagnostics v_changed = row_count;
  else
    delete from public.role_permission_grants
    where role_id = p_role_id
      and permission_id = v_permission_id
      and scope = 'all';
    get diagnostics v_changed = row_count;
  end if;

  insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data)
  values (
    p_actor_id,
    'admin',
    'role_permission_grant',
    p_role_id,
    case when p_granted then 'grant_permission' else 'revoke_permission' end,
    jsonb_build_object(
      'permission_code', 'task.quick_report.create',
      'role_id', p_role_id,
      'scope', 'all',
      'changed', v_changed
    )
  );

  return jsonb_build_object(
    'roleId', p_role_id,
    'permissionCode', 'task.quick_report.create',
    'granted', p_granted,
    'changed', v_changed
  );
end
$function$;

revoke all on function public.api_set_quick_report_permission(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.api_set_quick_report_permission(uuid, uuid, boolean) to service_role;
alter function public.api_set_quick_report_permission(uuid, uuid, boolean) owner to postgres;

notify pgrst, 'reload schema';
commit;

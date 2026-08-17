create or replace function public.api_set_department_manager(
  p_actor uuid,
  p_department uuid,
  p_manager uuid
)
returns public.departments
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_department public.departments;
  v_old_manager uuid;
begin
  if not exists (
    select 1
    from public.staff_users actor
    join public.roles actor_role on actor_role.id = actor.role_id
    join public.role_permissions actor_permissions on actor_permissions.role_id = actor_role.id
    where actor.id = p_actor
      and actor.active = true
      and actor_role.code = 'admin'
      and coalesce(actor_permissions.can_manage_users, false) = true
  ) then
    raise exception 'Admin user management permission required.' using errcode = '42501';
  end if;

  select department.manager_id
  into v_old_manager
  from public.departments department
  where department.id = p_department
    and department.active = true
  for update;
  if not found then
    raise exception 'Active department not found.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.staff_users candidate
    where candidate.id = p_manager
      and candidate.active = true
      and candidate.department_id = p_department
  ) then
    raise exception 'Manager must be active and belong to the department.' using errcode = '22023';
  end if;

  update public.departments
  set manager_id = p_manager
  where id = p_department
  returning * into v_department;

  insert into public.audit_logs(
    actor_id, module, entity_type, entity_id, action, old_data, new_data
  ) values (
    p_actor,
    'admin',
    'department',
    p_department,
    'set_manager',
    jsonb_build_object('manager_id', v_old_manager),
    jsonb_build_object('manager_id', p_manager)
  );

  return v_department;
end
$function$;

revoke all on function public.api_set_department_manager(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.api_set_department_manager(uuid,uuid,uuid) to service_role;
alter function public.api_set_department_manager(uuid,uuid,uuid) owner to postgres;

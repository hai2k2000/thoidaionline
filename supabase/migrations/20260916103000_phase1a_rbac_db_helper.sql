-- Phase 1A Checkpoint 2: server-only grant reader for shadow authorization.
begin;

create or replace function public.api_list_role_permission_grants(p_actor_id uuid)
returns table(permission_code text, scope text)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if p_actor_id is null or not exists (
    select 1 from public.staff_users u
    join public.roles r on r.id = u.role_id
    where u.id = p_actor_id and u.active = true and r.active = true
  ) then
    raise exception 'Invalid actor.' using errcode = '42501';
  end if;

  return query
  select p.code, g.scope
  from public.staff_users u
  join public.roles r on r.id = u.role_id
  join public.role_permission_grants g on g.role_id = r.id
  join public.permissions p on p.id = g.permission_id
  where u.id = p_actor_id and u.active = true and r.active = true
  order by p.code, g.scope;
end;
$function$;

revoke all on function public.api_list_role_permission_grants(uuid) from public, anon, authenticated;
grant execute on function public.api_list_role_permission_grants(uuid) to service_role;

commit;

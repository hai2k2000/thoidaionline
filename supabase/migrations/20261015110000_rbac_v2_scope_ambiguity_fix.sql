begin;

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
  select e.permission_code, expanded.granted_scope
  from public.api_list_effective_permissions(p_actor_id) e
  cross join lateral unnest(e.effective_scopes) as expanded(granted_scope)
  order by e.permission_code, expanded.granted_scope;
end
$function$;

alter function public.api_list_role_permission_grants(uuid) owner to postgres;
revoke all on function public.api_list_role_permission_grants(uuid) from public, anon, authenticated;
grant execute on function public.api_list_role_permission_grants(uuid) to service_role;

commit;

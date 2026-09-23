begin;

-- Harden the installed Journalism scope without rewriting applied migrations.
create or replace function public.api_assert_journalism_department_scope(
  p_actor_id uuid,
  p_department_id uuid default null
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_role_code text;
  v_actor_department_code text;
  v_target_department_code text;
begin
  select r.code, d.code into v_role_code, v_actor_department_code
  from public.staff_users u
  join public.roles r on r.id = u.role_id and r.active = true
  left join public.departments d on d.id = u.department_id and d.active = true
  where u.id = p_actor_id and u.active = true;
  if v_role_code is null then raise exception 'Invalid actor.' using errcode = '42501'; end if;
  if v_role_code not in ('tong_bien_tap', 'pho_tong_bien_tap')
     and v_actor_department_code is distinct from 'editorial' then
    raise exception 'Journalism is limited to Content department.' using errcode = '42501';
  end if;
  if p_department_id is not null then
    select d.code into v_target_department_code from public.departments d
    where d.id = p_department_id and d.active = true;
    if v_target_department_code is distinct from 'editorial' then
      raise exception 'Journalism target must be Content department.' using errcode = '42501';
    end if;
  end if;
end
$function$;

revoke all on function public.api_assert_journalism_department_scope(uuid,uuid) from public, anon, authenticated;
grant execute on function public.api_assert_journalism_department_scope(uuid,uuid) to service_role;
commit;

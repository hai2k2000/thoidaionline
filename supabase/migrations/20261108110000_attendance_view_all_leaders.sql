-- Owner approval 2026-11-08: grant leader attendance access for evaluation summary attendance column.
begin;

do $$
declare
  missing_count integer;
begin
  select count(*) into missing_count
  from (values ('tong_bien_tap'), ('truong_phong')) as expected(code)
  where not exists (select 1 from public.roles r where r.code = expected.code);
  if missing_count > 0 then
    raise exception 'Required attendance leader role is missing';
  end if;

  if not exists (select 1 from public.permissions where code = 'attendance.view_all') then
    raise exception 'Required permission attendance.view_all is missing';
  end if;
end $$;

insert into public.role_permission_grants(role_id, permission_id, scope)
select r.id, p.id, 'all'
from public.roles r
cross join public.permissions p
where r.code = 'tong_bien_tap' and p.code = 'attendance.view_all'
on conflict (role_id, permission_id, scope) do nothing;

insert into public.role_permission_grants(role_id, permission_id, scope)
select r.id, p.id, 'department'
from public.roles r
cross join public.permissions p
where r.code = 'truong_phong' and p.code = 'attendance.view_all'
on conflict (role_id, permission_id, scope) do nothing;

notify pgrst, 'reload schema';
commit;

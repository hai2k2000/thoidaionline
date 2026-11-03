begin;
-- Serialize against staff assignment while checking the rollback precondition.
lock table public.staff_users in share row exclusive mode;
do $$
begin
  if exists (
    select 1 from public.staff_users u join public.roles r on r.id = u.role_id
    where r.code = 'cong_tac_vien'
  ) then
    raise exception 'Cannot revert cong_tac_vien while staff_users still reference this role';
  end if;
end $$;
delete from public.role_permission_grants where role_id = (select id from public.roles where code = 'cong_tac_vien');
delete from public.role_permissions where role_id = (select id from public.roles where code = 'cong_tac_vien');
delete from public.roles where code = 'cong_tac_vien';
commit;

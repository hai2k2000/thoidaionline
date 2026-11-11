begin;

delete from public.role_permission_grants
where permission_id = (select id from public.permissions where code = 'attendance.view_all')
  and (role_id, scope) in (
    ((select id from public.roles where code = 'tong_bien_tap'), 'all'),
    ((select id from public.roles where code = 'truong_phong'), 'department')
  );

notify pgrst, 'reload schema';
commit;

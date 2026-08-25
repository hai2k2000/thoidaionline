begin;
update public.departments d set manager_id=u.id from public.staff_users u join public.roles r on r.id=u.role_id where d.code='leadership' and r.code='tong_bien_tap' and u.active=true;
commit;

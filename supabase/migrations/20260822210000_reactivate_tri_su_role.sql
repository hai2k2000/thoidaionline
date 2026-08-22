begin;

update public.roles
set active = true
where code = 'tri_su';

commit;

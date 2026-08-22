begin;

update public.staff_users
set role_id = (select id from public.roles where code = 'nhan_vien'),
    department_id = (select id from public.departments where code = 'general'),
    job_title_id = (select id from public.job_titles where code = 'nhan_vien')
where username = 'thanhhai';

update public.roles
set active = false
where code = 'tri_su'
  and not exists (select 1 from public.staff_users where role_id = public.roles.id and active = true);

commit;

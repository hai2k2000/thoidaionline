begin;

-- Restore the known staff seed account with the correct department.
-- Idempotent: update an existing username/email, otherwise insert once.
with target as (
  select
    'Đoàn Thanh Hải'::text as full_name,
    'thanhhai'::text as username,
    'doan.thanh.hai@baothoidai.local'::text as email,
    r.id as role_id,
    jt.id as job_title_id,
    d.id as department_id
  from public.roles r
  cross join public.job_titles jt
  cross join public.departments d
  where r.code='tri_su' and jt.code='nhan_vien' and d.code='general'
), existing as (
  select su.id from public.staff_users su
  where lower(su.username)='thanhhai' or lower(su.email)=lower('doan.thanh.hai@baothoidai.local')
  limit 1
)
update public.staff_users su
set full_name=t.full_name,
    username=t.username,
    email=t.email,
    role_id=t.role_id,
    job_title_id=t.job_title_id,
    department_id=t.department_id,
    active=true,
    list_order=1
from target t
where su.id in (select id from existing);

with target as (
  select
    'Đoàn Thanh Hải'::text as full_name,
    'thanhhai'::text as username,
    'doan.thanh.hai@baothoidai.local'::text as email,
    r.id as role_id,
    jt.id as job_title_id,
    d.id as department_id
  from public.roles r
  cross join public.job_titles jt
  cross join public.departments d
  where r.code='tri_su' and jt.code='nhan_vien' and d.code='general'
)
insert into public.staff_users(full_name,username,email,password,password_hash,role_id,job_title_id,department_id,active,list_order)
select t.full_name,t.username,t.email,null,extensions.crypt('123456',extensions.gen_salt('bf',12)),t.role_id,t.job_title_id,t.department_id,true,1
from target t
where not exists (
  select 1 from public.staff_users su
  where lower(su.username)=lower(t.username) or lower(su.email)=lower(t.email)
);

notify pgrst,'reload schema';
commit;

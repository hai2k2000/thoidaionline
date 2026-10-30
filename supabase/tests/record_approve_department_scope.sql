-- Disposable production-backup behaviour test. Run as supabase_admin.
begin;

create temporary table zz_record_approve_users (key text primary key, id uuid not null) on commit drop;
create temporary table zz_record_approve_departments (key text primary key, id uuid not null) on commit drop;
create temporary table zz_record_approve_records (key text primary key, id uuid not null) on commit drop;

insert into public.departments(code, name, active)
values ('zz_record_approve_a', 'zz_record_approve_A', true), ('zz_record_approve_b', 'zz_record_approve_B', true)
returning code, id;
insert into zz_record_approve_departments
select case when code = 'zz_record_approve_a' then 'a' else 'b' end, id
from public.departments where code in ('zz_record_approve_a', 'zz_record_approve_b');

insert into public.staff_users(full_name, username, email, password, role_id, department_id, job_title_id, active)
select 'zz_record_approve_' || x.key, 'zz_record_approve_' || x.key, x.key || '@zz-record-approve.invalid', 'zz_record_approve',
  (select id from public.roles where code = 'nhan_vien' limit 1),
  case when x.department_key is null then null else (select id from zz_record_approve_departments where key = x.department_key) end,
  (select id from public.job_titles where code = 'nhan_vien' limit 1), true
from (values ('admin', null), ('approver_a', 'a'), ('approver_all', 'a'), ('owner_a', 'a'), ('owner_b', 'b'), ('manager_a', 'a'), ('no_department', null)) x(key, department_key);
insert into zz_record_approve_users
select substring(full_name from 21), id from public.staff_users where full_name like 'zz_record_approve_%';

update public.departments set manager_id = (select id from zz_record_approve_users where key = 'manager_a')
where id = (select id from zz_record_approve_departments where key = 'a');

insert into public.user_permission_grants(user_id, permission_id, scope, effect, created_by)
select u.id, p.id, x.scope, 'allow', (select id from zz_record_approve_users where key = 'admin')
from (values ('approver_a','department'), ('approver_all','all')) x(user_key, scope)
join zz_record_approve_users u on u.key = x.user_key
join public.permissions p on p.code = 'record.approve';

insert into public.db_categories(code, name) values ('zz_record_approve_category', 'zz_record_approve_category') on conflict (code) do nothing;
insert into public.db_record_types(category_id, code, name)
select id, 'zz_record_approve_type', 'zz_record_approve_type' from public.db_categories where code = 'zz_record_approve_category'
on conflict (code) do nothing;

insert into public.db_records(category_id, record_type_id, record_code, title, status, department_id, owner_id, created_by)
select c.id, t.id, 'zz_record_approve_' || x.key, 'zz_record_approve_' || x.key, 'pending_review',
  (select id from zz_record_approve_departments where key = x.department_key),
  (select id from zz_record_approve_users where key = x.owner_key),
  (select id from zz_record_approve_users where key = x.owner_key)
from (values ('a','a','owner_a'), ('b','b','owner_b'), ('self','a','approver_a'), ('manager','a','owner_a')) x(key, department_key, owner_key)
cross join public.db_categories c cross join public.db_record_types t
where c.code = 'zz_record_approve_category' and t.code = 'zz_record_approve_type';
insert into zz_record_approve_records
select substring(record_code from 21), id from public.db_records where record_code like 'zz_record_approve_%';

do $$ declare v uuid; begin
  v := (select id from zz_record_approve_users where key = 'approver_a');
  perform public.api_transition_database_record(v, (select id from zz_record_approve_records where key = 'a'), 'approve');
  raise notice 'PASS 1 department approver approves own department';
end $$;
do $$ begin
  begin perform public.api_transition_database_record((select id from zz_record_approve_users where key = 'approver_a'), (select id from zz_record_approve_records where key = 'b'), 'approve'); raise exception 'FAIL 2 cross-department approve'; exception when sqlstate = '42501' then raise notice 'PASS 2 cross-department approve rejected'; end;
end $$;
do $$ begin
  begin perform public.api_transition_database_record((select id from zz_record_approve_users where key = 'approver_a'), (select id from zz_record_approve_records where key = 'b'), 'return', 'Sửa hồ sơ'); raise exception 'FAIL 3 cross-department return'; exception when sqlstate = '42501' then raise notice 'PASS 3 cross-department return rejected'; end;
end $$;
do $$ begin
  perform public.api_transition_database_record((select id from zz_record_approve_users where key = 'approver_all'), (select id from zz_record_approve_records where key = 'b'), 'approve');
  raise notice 'PASS 4 all-scoped approver approves B';
end $$;
do $$ begin
  begin perform public.api_transition_database_record((select id from zz_record_approve_users where key = 'approver_a'), (select id from zz_record_approve_records where key = 'self'), 'approve'); raise exception 'FAIL 5 self approval'; exception when sqlstate = '42501' then raise notice 'PASS 5 self approval rejected'; end;
end $$;
do $$ begin
  perform public.api_transition_database_record((select id from zz_record_approve_users where key = 'manager_a'), (select id from zz_record_approve_records where key = 'manager'), 'approve');
  raise notice 'PASS 6 department manager approves without record.approve';
end $$;
do $$ begin
  begin perform public.api_transition_database_record((select id from zz_record_approve_users where key = 'no_department'), (select id from zz_record_approve_records where key = 'a'), 'approve'); raise exception 'FAIL 7 no-department approver'; exception when sqlstate = '42501' then raise notice 'PASS 7 no-department approver rejected'; end;
end $$;
do $$ begin
  if not public.rbac_v2_scope_supported('record.approve','department') or public.rbac_v2_scope_supported('record.approve','self') or not public.rbac_v2_scope_supported('leave.approve','department') then raise exception 'FAIL 8 scope support'; end if;
  raise notice 'PASS 8 scope support';
end $$;
do $$ begin
  perform public.api_set_user_permission_override((select id from zz_record_approve_users where key = 'admin'), (select id from zz_record_approve_users where key = 'no_department'), 'record.approve', 'allow', 'department');
  raise notice 'PASS 9 department override accepted';
end $$;

raise notice 'ALL_PASS';
rollback;

-- Phase 2B disposable behaviour suite. Every object created here is rolled back.
-- Schema checked against: fixture-tables-schema.sql, fixture-tables-constraints.sql,
-- fixture-trigger-functions.sql (staff_users, departments, leave_requests,
-- work_schedules, user_permission_grants, roles, job_titles).
begin;

create temporary table zz_rbac_test_users (key text primary key, id uuid not null) on commit drop;
create temporary table zz_rbac_test_departments (key text primary key, id uuid not null) on commit drop;
create temporary table zz_rbac_test_leaves (key text primary key, id uuid not null) on commit drop;
create temporary table zz_rbac_test_plans (key text primary key, id uuid not null) on commit drop;

insert into public.departments(code, name, active)
values ('zz_rbac_test_a', 'zz_rbac_test_A', true), ('zz_rbac_test_b', 'zz_rbac_test_B', true)
returning code, id;
insert into zz_rbac_test_departments
select case when code = 'zz_rbac_test_a' then 'a' else 'b' end, id
from public.departments where code in ('zz_rbac_test_a', 'zz_rbac_test_b');

insert into public.staff_users(full_name, username, email, password, role_id, department_id, job_title_id, active)
select 'zz_rbac_test_' || x.key, 'zz_rbac_test_' || x.key || '_' || x.department_key,
       x.key || '@zz-rbac-test.invalid', 'zz_rbac_test',
       (select id from public.roles where code = x.role_code limit 1),
       (select id from zz_rbac_test_departments where key = x.department_key),
       (select id from public.job_titles where code = x.job_code limit 1), x.active
from (values
  ('tbt','tong_bien_tap','a','tong_bien_tap',true),
  ('ptbt','pho_tong_bien_tap','a','pho_tong_bien_tap',true),
  ('admin','admin','a','nhan_vien',true),
  ('manager','nhan_vien','a','truong_phong',true),
  ('staff_a','nhan_vien','a','nhan_vien',true),
  ('staff_b','nhan_vien','b','nhan_vien',true),
  ('pho_role','pho_truong_phong','a','phong_vien',true),
  ('inactive_allow','nhan_vien','a','nhan_vien',false),
  ('override','nhan_vien','a','nhan_vien',true)
) x(key, role_code, department_key, job_code, active);
insert into zz_rbac_test_users
select substring(u.full_name from 14), u.id
from public.staff_users u where u.full_name like 'zz_rbac_test_%';

do $$ begin
  if not exists (
    select 1
    from public.departments d
    join public.staff_users u on u.id=d.manager_id
    join public.job_titles jt on jt.id=u.job_title_id
    where d.id=(select id from zz_rbac_test_departments where key='a')
      and u.id=(select id from zz_rbac_test_users where key='manager')
      and u.active and u.department_id=d.id and lower(jt.code)='truong_phong'
  ) then
    raise exception 'RBAC_TEST_FAIL setup manager';
  end if;
  if (select manager_id from public.departments where id=(select id from zz_rbac_test_departments where key='b')) is not null then
    raise exception 'RBAC_TEST_FAIL setup manager';
  end if;
end $$;

insert into public.user_permission_grants(user_id, permission_id, scope, effect, created_by)
select u.id, p.id, x.scope, x.effect, (select id from zz_rbac_test_users where key='admin')
from (values
  ('staff_a','leave.approve','department','allow'),
  ('staff_b','leave.approve','all','allow'),
  ('inactive_allow','leave.approve','all','allow'),
  ('override','leave.approve','all','deny')
) x(user_key, permission_code, scope, effect)
join zz_rbac_test_users u on u.key=x.user_key
join public.permissions p on p.code=x.permission_code;
insert into public.user_permission_grants(user_id, permission_id, scope, effect, created_by)
select (select id from zz_rbac_test_users where key='tbt'), p.id, 'all', 'deny', (select id from zz_rbac_test_users where key='admin')
from public.permissions p where p.code='leave.approve';

insert into public.leave_requests(requester_id, department_id, start_date, end_date, start_period, end_period, leave_type, reason)
select (select id from zz_rbac_test_users where key='staff_a'), (select id from zz_rbac_test_departments where key='a'), x.start_date, x.end_date, x.start_period, x.end_period, 'annual', 'zz_rbac_test_' || x.key
from (values
  ('half', current_date + 1, current_date + 1, 'morning', 'morning'),
  ('one', current_date + 2, current_date + 2, 'full', 'full'),
  ('two', current_date + 3, current_date + 4, 'full', 'full'),
  ('three', current_date + 5, current_date + 7, 'full', 'full'),
  ('four', current_date + 8, current_date + 11, 'full', 'full'),
  ('fri_mon', date_trunc('week', current_date)::date + 4, date_trunc('week', current_date)::date + 7, 'full', 'full')
) x(key, start_date, end_date, start_period, end_period)
returning id, 'zz_rbac_test_' || right(reason, length(reason)-15);
insert into zz_rbac_test_leaves
select substring(reason from 14), id from public.leave_requests where reason like 'zz_rbac_test_%';
update public.leave_requests
set requester_id=(select id from zz_rbac_test_users where key='pho_role'), department_id=(select id from zz_rbac_test_departments where key='a')
where reason='zz_rbac_test_two';

insert into public.work_schedules(work_date, end_date, plan_type, start_time, end_time, title, participant_ids, created_by, schedule_scope, approval_status, workflow_revision)
select current_date + (row_number() over ())::int, current_date + (row_number() over ())::int, x.plan_type, '09:00', '10:00', 'zz_rbac_test_' || x.plan_type, array[(select id from zz_rbac_test_users where key='pho_role')], (select id from zz_rbac_test_users where key='pho_role'), 'personal', 'PENDING_APPROVAL', 1
from (values ('business'), ('event'), ('work')) x(plan_type)
returning id, plan_type;
insert into zz_rbac_test_plans
select plan_type, id from public.work_schedules where title = 'zz_rbac_test_' || plan_type;

do $$ declare v_id uuid; begin
  begin perform public.api_review_leave_request((select id from zz_rbac_test_users where key='pho_role'), (select id from zz_rbac_test_leaves where key='one'), 'approved', 'x'); raise exception 'RBAC_TEST_FAIL 1 unprivileged review succeeded'; exception when sqlstate '42501' then raise notice 'RBAC_TEST_PASS 1'; end;
end $$;
do $$ begin
  perform public.api_review_leave_request((select id from zz_rbac_test_users where key='staff_a'), (select id from zz_rbac_test_leaves where key='two'), 'approved', 'x');
  if (select status from public.leave_requests where id=(select id from zz_rbac_test_leaves where key='two')) <> 'approved' then raise exception 'RBAC_TEST_FAIL 2 status'; end if;
  if not exists (select 1 from public.audit_logs where entity_id=(select id from zz_rbac_test_leaves where key='two') and new_data->>'approval_basis'='user_allow') then raise exception 'RBAC_TEST_FAIL 2 basis'; end if;
  raise notice 'RBAC_TEST_PASS 2';
end $$;
do $$ begin
  begin perform public.api_review_personal_work_schedule((select id from zz_rbac_test_users where key='staff_a'), (select id from zz_rbac_test_plans where key='business'), 'approve', 'x', 1); raise exception 'RBAC_TEST_FAIL 3 business unexpectedly allowed'; exception when sqlstate '42501' then raise notice 'RBAC_TEST_PASS 3'; end;
end $$;
do $$ begin
  begin perform public.api_review_personal_work_schedule((select id from zz_rbac_test_users where key='staff_a'), (select id from zz_rbac_test_plans where key='event'), 'approve', 'x', 1); raise exception 'RBAC_TEST_FAIL 4 event unexpectedly allowed'; exception when sqlstate '42501' then raise notice 'RBAC_TEST_PASS 4'; end;
  if exists (select 1 from public.api_list_reviewable_personal_plans((select id from zz_rbac_test_users where key='staff_a')) where id=(select id from zz_rbac_test_plans where key='event')) then raise exception 'RBAC_TEST_FAIL 4 list'; end if;
end $$;
do $$ begin
  if public.approval_review_basis((select id from zz_rbac_test_users where key='staff_a'),'leave.approve',(select id from zz_rbac_test_users where key='staff_b'),(select id from zz_rbac_test_departments where key='b'),1) is not null then raise exception 'RBAC_TEST_FAIL 5 cross department'; end if; raise notice 'RBAC_TEST_PASS 5';
end $$;
do $$ begin
  if public.approval_review_basis((select id from zz_rbac_test_users where key='staff_b'),'leave.approve',(select id from zz_rbac_test_users where key='staff_a'),(select id from zz_rbac_test_departments where key='a'),1) is null then raise exception 'RBAC_TEST_FAIL 6 all scope'; end if; raise notice 'RBAC_TEST_PASS 6';
end $$;
do $$ begin
  begin perform public.api_review_leave_request((select id from zz_rbac_test_users where key='tbt'), (select id from zz_rbac_test_leaves where key='one'), 'approved', 'x'); raise exception 'RBAC_TEST_FAIL 7 deny'; exception when sqlstate '42501' then null; end;
  if public.approval_review_basis((select id from zz_rbac_test_users where key='tbt'), 'leave.approve', (select id from zz_rbac_test_users where key='staff_a'), (select id from zz_rbac_test_departments where key='a'), 3) is distinct from 'tbt_rule' then raise exception 'RBAC_TEST_FAIL 7 tbt'; end if;
  raise notice 'RBAC_TEST_PASS 7';
end $$;
do $$ begin
  delete from public.user_permission_grants where user_id=(select id from zz_rbac_test_users where key='staff_a') and permission_id=(select id from public.permissions where code='leave.approve');
  begin perform public.api_review_leave_request((select id from zz_rbac_test_users where key='staff_a'), (select id from zz_rbac_test_leaves where key='one'), 'approved', 'x'); raise exception 'RBAC_TEST_FAIL 8 revoke'; exception when sqlstate '42501' then raise notice 'RBAC_TEST_PASS 8'; end;
end $$;
do $$ begin
  begin perform public.api_review_leave_request((select id from zz_rbac_test_users where key='staff_a'), (select id from zz_rbac_test_leaves where key='half'), 'approved', 'x'); raise exception 'RBAC_TEST_FAIL 9 self'; exception when sqlstate '42501' then raise notice 'RBAC_TEST_PASS 9'; end;
end $$;
do $$ begin
  update public.leave_requests set status='approved' where id=(select id from zz_rbac_test_leaves where key='one');
  begin perform public.api_review_leave_request((select id from zz_rbac_test_users where key='staff_b'), (select id from zz_rbac_test_leaves where key='one'), 'approved', 'x'); raise exception 'RBAC_TEST_FAIL 10 terminal'; exception when sqlstate '55000' then raise notice 'RBAC_TEST_PASS 10'; end;
end $$;
do $$ begin
  update public.leave_requests set status='cancelled' where id=(select id from zz_rbac_test_leaves where key='half');
  begin perform public.api_review_leave_request((select id from zz_rbac_test_users where key='staff_b'), (select id from zz_rbac_test_leaves where key='half'), 'approved', 'x'); raise exception 'RBAC_TEST_FAIL 11 cancelled'; exception when sqlstate '55000' then raise notice 'RBAC_TEST_PASS 11'; end;
end $$;
do $$ begin
  begin perform public.api_review_personal_work_schedule((select id from zz_rbac_test_users where key='manager'), (select id from zz_rbac_test_plans where key='work'), 'approve', 'x', 0); raise exception 'RBAC_TEST_FAIL 12 revision'; exception when sqlstate '55000' then raise notice 'RBAC_TEST_PASS 12'; end;
end $$;
do $$ begin
  if has_function_privilege('anon','public.approval_review_basis(uuid,text,uuid,uuid,integer)','execute') or has_function_privilege('authenticated','public.api_review_leave_request(uuid,uuid,text,text)','execute') or has_function_privilege('public','public.api_review_personal_work_schedule(uuid,uuid,text,text,bigint)','execute') then raise exception 'RBAC_TEST_FAIL 14 public privilege'; end if;
  if not has_function_privilege('service_role','public.approval_review_basis(uuid,text,uuid,uuid,integer)','execute') then raise exception 'RBAC_TEST_FAIL 14 service privilege'; end if;
  raise notice 'RBAC_TEST_PASS 14';
end $$;
do $$ begin
  if public.approval_review_basis((select id from zz_rbac_test_users where key='manager'),'leave.approve',(select id from zz_rbac_test_users where key='staff_a'),(select id from zz_rbac_test_departments where key='a'),1) is null then raise exception 'RBAC_TEST_FAIL 15 structural manager'; end if; raise notice 'RBAC_TEST_PASS 15';
end $$;
do $$ begin
  if (select count(*) from public.api_list_reviewable_leave_requests((select id from zz_rbac_test_users where key='staff_a'),current_date,current_date+30)) <> 0 then raise exception 'RBAC_TEST_FAIL 18 list denied'; end if; raise notice 'RBAC_TEST_PASS 18';
end $$;
do $$ begin
  if public.approval_review_basis((select id from zz_rbac_test_users where key='inactive_allow'),'leave.approve',(select id from zz_rbac_test_users where key='staff_a'),(select id from zz_rbac_test_departments where key='a'),1) is not null then raise exception 'RBAC_TEST_FAIL 19 inactive'; end if; raise notice 'RBAC_TEST_PASS 19';
end $$;
do $$ begin
  if public.approval_review_basis((select id from zz_rbac_test_users where key='manager'),'schedule.business.approve',(select id from zz_rbac_test_users where key='staff_a'),(select id from zz_rbac_test_departments where key='a')) is null then raise exception 'RBAC_TEST_FAIL 22 manager plan'; end if; raise notice 'RBAC_TEST_PASS 22';
end $$;
do $$ begin
  if public.approval_review_basis((select id from zz_rbac_test_users where key='ptbt'),'schedule.event.approve',(select id from zz_rbac_test_users where key='staff_b'),(select id from zz_rbac_test_departments where key='b')) is null then raise exception 'RBAC_TEST_FAIL 23 ptbt'; end if; raise notice 'RBAC_TEST_PASS 23';
end $$;
do $$ begin
  begin perform public.api_review_personal_work_schedule((select id from zz_rbac_test_users where key='manager'),(select id from zz_rbac_test_plans where key='work'),'approve','x',1); if (select approval_status from public.work_schedules where id=(select id from zz_rbac_test_plans where key='work')) <> 'APPROVED' then raise exception 'RBAC_TEST_FAIL 24 work'; end if; raise notice 'RBAC_TEST_PASS 24'; exception when others then if sqlstate='P0002' then raise; else raise exception 'RBAC_TEST_FAIL 24 %',sqlerrm; end if; end;
end $$;
do $$ begin
  if public.approval_review_basis((select id from zz_rbac_test_users where key='tbt'),'leave.approve',(select id from zz_rbac_test_users where key='staff_a'),(select id from zz_rbac_test_departments where key='a'),3) is distinct from 'tbt_rule' then raise exception 'RBAC_TEST_FAIL D-3'; end if; raise notice 'RBAC_TEST_PASS D-3';
end $$;
do $$ begin
  insert into public.user_permission_grants(user_id,permission_id,scope,effect,created_by) select (select id from zz_rbac_test_users where key='override'),(select id from public.permissions where code='leave.approve'),'all','allow',(select id from zz_rbac_test_users where key='admin') on conflict (user_id,permission_id) do update set effect='allow',scope='all';
  if public.approval_review_basis((select id from zz_rbac_test_users where key='override'),'leave.approve',(select id from zz_rbac_test_users where key='tbt'),(select id from zz_rbac_test_departments where key='a'),1) is not null then raise exception 'RBAC_TEST_FAIL D-4'; end if; raise notice 'RBAC_TEST_PASS D-4';
end $$;

rollback;

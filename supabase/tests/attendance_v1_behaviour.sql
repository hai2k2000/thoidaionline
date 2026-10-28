begin;

-- Disposable fixtures are rolled back with the suite.
alter table public.staff_users alter column department_id drop not null;
create temporary table zz_att_test_users (key text primary key, id uuid not null) on commit drop;
create temporary table zz_att_test_departments (key text primary key, id uuid not null) on commit drop;
create temporary table zz_att_test_logs (key text primary key, id uuid not null) on commit drop;

insert into public.departments(code, name, active)
values ('zz_att_test_a', 'zz_att_test_A', true), ('zz_att_test_b', 'zz_att_test_B', true)
returning code, id;
insert into zz_att_test_departments
select case when code='zz_att_test_a' then 'a' else 'b' end, id
from public.departments where code like 'zz_att_test_%';

insert into public.staff_users(full_name, username, email, password, role_id, department_id, active)
select 'zz_att_test_' || x.key, 'zz_att_test_' || x.key, x.key || '@zz-att-test.invalid', 'zz_att_test',
       (select id from public.roles where code=x.role_code limit 1),
       case when x.department_key is null then null else (select id from zz_att_test_departments where key=x.department_key) end,
       true
from (values
  ('admin','admin','a'), ('head_a','nhan_vien','a'), ('viewer_all','nhan_vien','b'),
  ('staff_a1','nhan_vien','a'), ('staff_a2','nhan_vien','a'), ('staff_b1','nhan_vien','b'),
  ('nodept1','nhan_vien',null), ('nodept2','nhan_vien',null)
) x(key, role_code, department_key);
insert into zz_att_test_users select substring(username from 13), id from public.staff_users where username like 'zz_att_test_%';

insert into public.user_permission_grants(user_id, permission_id, scope, effect, created_by)
select u.id, p.id, x.scope, 'allow', (select id from zz_att_test_users where key='admin')
from (values ('head_a','attendance.view_all','department'), ('viewer_all','attendance.view_all','all'),
             ('nodept1','attendance.view_all','department')) x(user_key, permission_code, scope)
join zz_att_test_users u on u.key=x.user_key
join public.permissions p on p.code=x.permission_code;

insert into public.attendance_logs(user_id, work_date, check_in, status, source)
select u.id, current_date + x.day_offset, x.check_in, x.status, 'zz_att_test'
from (values ('staff_a1', time '08:30', 'present', 0), ('staff_a2', time '08:30', 'present', 0),
             ('staff_b1', time '08:30', 'present', 0), ('nodept2', time '08:30', 'present', 0),
             ('staff_a2_leave', time '08:30', 'leave', 1)) x(key, check_in, status, day_offset)
join zz_att_test_users u on u.key=case when x.key='staff_a2_leave' then 'staff_a2' else x.key end
on conflict (user_id, work_date) do update set check_in=excluded.check_in, status=excluded.status;
insert into zz_att_test_logs
select case when l.status='leave' then 'leave' else u.key end, l.id
from public.attendance_logs l join zz_att_test_users u on u.id=l.user_id
where u.key in ('staff_a1','staff_a2','staff_b1','nodept2');

do $$ begin
  if public.rbac_v2_scope_supported('attendance.view_all','department') and public.rbac_v2_scope_supported('attendance.view_all','all') and not public.rbac_v2_scope_supported('attendance.view_all','self') then raise notice 'ATT_TEST_PASS scope_view_all'; else raise notice 'ATT_TEST_FAIL scope_view_all'; end if;
  if public.rbac_v2_scope_supported('attendance.manage','all') and not public.rbac_v2_scope_supported('attendance.manage','department') then raise notice 'ATT_TEST_PASS scope_manage'; else raise notice 'ATT_TEST_FAIL scope_manage'; end if;
  if public.rbac_v2_scope_supported('leave.approve','department') then raise notice 'ATT_TEST_PASS scope_leave'; else raise notice 'ATT_TEST_FAIL scope_leave'; end if;
end $$;

do $$ declare v jsonb; begin
  update public.attendance_logs set check_in=time '08:10', status='present' where id=(select id from zz_att_test_logs where key='staff_a1');
  begin perform public.api_request_late_exception((select id from zz_att_test_users where key='staff_a1'), current_date, 'too early'); raise notice 'ATT_TEST_FAIL request_0810'; exception when sqlstate '22023' then raise notice 'ATT_TEST_PASS request_0810'; end;
  update public.attendance_logs set check_in=time '08:30', status='present' where id=(select id from zz_att_test_logs where key='staff_a1');
  v:=public.api_request_late_exception((select id from zz_att_test_users where key='staff_a1'),current_date,'traffic');
  if v->>'late_exception_status'='pending' then raise notice 'ATT_TEST_PASS request_0830'; else raise notice 'ATT_TEST_FAIL request_0830'; end if;
  begin perform public.api_request_late_exception((select id from zz_att_test_users where key='staff_a1'),current_date,'again'); raise notice 'ATT_TEST_FAIL request_duplicate'; exception when sqlstate '40001' then raise notice 'ATT_TEST_PASS request_duplicate'; end;
  begin perform public.api_request_late_exception((select id from zz_att_test_users where key='staff_a2'),current_date+1,'leave'); raise notice 'ATT_TEST_FAIL request_leave'; exception when sqlstate '22023' then raise notice 'ATT_TEST_PASS request_leave'; end;
end $$;

do $$ declare v jsonb; begin
  begin perform public.api_review_late_exception((select id from zz_att_test_users where key='staff_a1'),(select id from zz_att_test_logs where key='staff_a1'),'approved','ok'); raise notice 'ATT_TEST_FAIL review_self'; exception when sqlstate '42501' then raise notice 'ATT_TEST_PASS review_self'; end;
  v:=public.api_review_late_exception((select id from zz_att_test_users where key='head_a'),(select id from zz_att_test_logs where key='staff_a1'),'approved','ok');
  if v->>'late_exception_status'='approved' then raise notice 'ATT_TEST_PASS review_head_same_department'; else raise notice 'ATT_TEST_FAIL review_head_same_department'; end if;
  update public.attendance_logs set late_exception='sudden_work', late_exception_status='pending', late_exception_reviewed_by=null, late_exception_reviewed_at=null where id=(select id from zz_att_test_logs where key='staff_b1');
  begin perform public.api_review_late_exception((select id from zz_att_test_users where key='head_a'),(select id from zz_att_test_logs where key='staff_b1'),'approved','ok'); raise notice 'ATT_TEST_FAIL review_head_cross_department'; exception when sqlstate '42501' then raise notice 'ATT_TEST_PASS review_head_cross_department'; end;
  v:=public.api_review_late_exception((select id from zz_att_test_users where key='viewer_all'),(select id from zz_att_test_logs where key='staff_b1'),'approved','ok');
  if v->>'late_exception_status'='approved' then raise notice 'ATT_TEST_PASS review_viewer_all'; else raise notice 'ATT_TEST_FAIL review_viewer_all'; end if;
  update public.attendance_logs set late_exception_status='pending', late_exception_reviewed_by=null, late_exception_reviewed_at=null where id=(select id from zz_att_test_logs where key='nodept2');
  update public.attendance_logs set late_exception='sudden_work', late_exception_status='pending' where id=(select id from zz_att_test_logs where key='nodept2');
  begin perform public.api_review_late_exception((select id from zz_att_test_users where key='nodept1'),(select id from zz_att_test_logs where key='nodept2'),'approved','ok'); raise notice 'ATT_TEST_FAIL review_null_department'; exception when sqlstate '42501' then raise notice 'ATT_TEST_PASS review_null_department'; end;
  update public.attendance_logs set late_exception_status='pending', late_exception_reviewed_by=null, late_exception_reviewed_at=null where id=(select id from zz_att_test_logs where key='staff_b1');
  begin perform public.api_review_late_exception((select id from zz_att_test_users where key='viewer_all'),(select id from zz_att_test_logs where key='staff_b1'),'rejected',''); raise notice 'ATT_TEST_FAIL review_no_note'; exception when sqlstate '22023' then raise notice 'ATT_TEST_PASS review_no_note'; end;
  perform public.api_review_late_exception((select id from zz_att_test_users where key='viewer_all'),(select id from zz_att_test_logs where key='staff_b1'),'rejected','not enough evidence');
  begin perform public.api_review_late_exception((select id from zz_att_test_users where key='viewer_all'),(select id from zz_att_test_logs where key='staff_b1'),'approved','again'); raise notice 'ATT_TEST_FAIL review_terminal'; exception when sqlstate '40001' then raise notice 'ATT_TEST_PASS review_terminal'; end;
end $$;

do $$ declare v uuid[]; begin
  update public.attendance_logs set late_exception='sudden_work', late_exception_status='pending', late_exception_reviewed_by=null, late_exception_reviewed_at=null where id in ((select id from zz_att_test_logs where key='staff_a2'),(select id from zz_att_test_logs where key='nodept2'));
  select array_agg(id order by id) into v from public.api_list_reviewable_late_exceptions((select id from zz_att_test_users where key='head_a'),current_date,current_date+2);
  if (select count(*) from public.api_list_reviewable_late_exceptions((select id from zz_att_test_users where key='head_a'),current_date,current_date+2))=1 and (select id from zz_att_test_logs where key='staff_a2')=any(v) then raise notice 'ATT_TEST_PASS reviewable_list'; else raise notice 'ATT_TEST_FAIL reviewable_list'; end if;
end $$;

do $$ begin
  if public.api_upsert_attendance_admin_note((select id from zz_att_test_users where key='admin'),(select id from zz_att_test_users where key='staff_a1'),current_date,'admin note') is not null then raise notice 'ATT_TEST_PASS admin_note_admin'; else raise notice 'ATT_TEST_FAIL admin_note_admin'; end if;
  begin perform public.api_upsert_attendance_admin_note((select id from zz_att_test_users where key='head_a'),(select id from zz_att_test_users where key='staff_a1'),current_date,'no'); raise notice 'ATT_TEST_FAIL admin_note_forbidden'; exception when sqlstate '42501' then raise notice 'ATT_TEST_PASS admin_note_forbidden'; end;
end $$;

do $$ declare v jsonb; d date:=current_date; begin
  v:=public.api_upsert_attendance_workday_adjustment((select id from zz_att_test_users where key='admin'),(select id from zz_att_test_users where key='staff_a1'),d,0.5,'half day');
  if (v->>'workday')::numeric=0.5 then raise notice 'ATT_TEST_PASS adjustment_create'; else raise notice 'ATT_TEST_FAIL adjustment_create'; end if;
  v:=public.api_upsert_attendance_workday_adjustment((select id from zz_att_test_users where key='admin'),(select id from zz_att_test_users where key='staff_a1'),d,1,'full day');
  if (v->>'workday')::numeric=1 then raise notice 'ATT_TEST_PASS adjustment_update'; else raise notice 'ATT_TEST_FAIL adjustment_update'; end if;
  begin perform public.api_upsert_attendance_workday_adjustment((select id from zz_att_test_users where key='admin'),(select id from zz_att_test_users where key='staff_a1'),date '2026-11-01',0.5,'weekend'); raise notice 'ATT_TEST_FAIL adjustment_weekend'; exception when sqlstate '22023' then raise notice 'ATT_TEST_PASS adjustment_weekend'; end;
  begin perform public.api_upsert_attendance_workday_adjustment((select id from zz_att_test_users where key='admin'),(select id from zz_att_test_users where key='admin'),d,0.5,'self'); raise notice 'ATT_TEST_FAIL adjustment_self'; exception when sqlstate '42501' then raise notice 'ATT_TEST_PASS adjustment_self'; end;
  begin perform public.api_upsert_attendance_workday_adjustment((select id from zz_att_test_users where key='head_a'),(select id from zz_att_test_users where key='staff_a1'),d,0.5,'forbidden'); raise notice 'ATT_TEST_FAIL adjustment_permission'; exception when sqlstate '42501' then raise notice 'ATT_TEST_PASS adjustment_permission'; end;
  begin perform public.api_upsert_attendance_workday_adjustment((select id from zz_att_test_users where key='admin'),(select id from zz_att_test_users where key='staff_a1'),d,0.7,'bad value'); raise notice 'ATT_TEST_FAIL adjustment_value'; exception when sqlstate '23514' then raise notice 'ATT_TEST_PASS adjustment_value'; when sqlstate '22023' then raise notice 'ATT_TEST_PASS adjustment_value'; end;
  perform public.api_delete_attendance_workday_adjustment((select id from zz_att_test_users where key='admin'),(select id from zz_att_test_users where key='staff_a1'),d);
  if not exists(select 1 from public.attendance_workday_adjustments where user_id=(select id from zz_att_test_users where key='staff_a1') and work_date=d) then raise notice 'ATT_TEST_PASS adjustment_delete'; else raise notice 'ATT_TEST_FAIL adjustment_delete'; end if;
end $$;

do $$ begin
  if (select column_default from information_schema.columns where table_schema='public' and table_name='staff_users' and column_name='attendance_exempt')='false'::text
     and (select is_nullable from information_schema.columns where table_schema='public' and table_name='staff_users' and column_name='attendance_exempt')='NO' then raise notice 'ATT_TEST_PASS exemption_column'; else raise notice 'ATT_TEST_FAIL exemption_column'; end if;
end $$;

rollback;

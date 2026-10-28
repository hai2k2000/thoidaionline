-- Disposable HTTP matrix fixture. Run only in the isolated e2e database.
begin;

insert into public.departments(code, name, active)
values ('zz_e2e_a', 'zz_e2e_A', true), ('zz_e2e_b', 'zz_e2e_B', true);

insert into public.staff_users(full_name, username, email, password, role_id, department_id, job_title_id, active, list_order)
select 'zz_e2e_' || x.username, 'zz_e2e_' || x.username, 'zz_e2e_' || x.username || '@zz-e2e.invalid',
       :'e2e_password',
       (select id from public.roles where code=x.role_code limit 1),
       (select id from public.departments where code='zz_e2e_' || x.department_code),
       (select id from public.job_titles where code=x.job_code limit 1), x.active, x.ord
from (values
  ('admin','admin','a','nhan_vien',true,1),
  ('tbt','tong_bien_tap','a','tong_bien_tap',true,2),
  ('ptbt','pho_tong_bien_tap','a','pho_tong_bien_tap',true,3),
  ('manager_a','nhan_vien','a','truong_phong',true,4),
  ('deputy_a','pho_truong_phong','a','phong_vien',true,5),
  ('rep_a1','nhan_vien','a','phong_vien',true,6),
  ('rep_a2','nhan_vien','a','phong_vien',true,7),
  ('rep_b1','nhan_vien','b','phong_vien',true,8),
  ('staff_a','nhan_vien','a','nhan_vien',true,9),
  ('inactive_a','nhan_vien','a','nhan_vien',false,10)
) x(username,role_code,department_code,job_code,active,ord);

insert into public.leave_requests(requester_id, department_id, start_date, end_date, start_period, end_period, leave_type, reason)
select u.id, u.department_id, current_date + v.offset, current_date + v.offset + v.length - 1,
       case when v.length=1 and v.key='half' then 'morning' else 'full' end, case when v.length=1 and v.key='half' then 'morning' else 'full' end,
       'annual', 'zz_e2e_leave_' || v.key
from (values ('half',1,1),('one',2,1),('two',4,2),('four',7,4)) v(key,offset,length)
cross join lateral (select id, department_id from public.staff_users where username='zz_e2e_rep_a1') u;
insert into public.leave_requests(requester_id, department_id, start_date, end_date, leave_type, reason)
select id, department_id, current_date + 12, current_date + 12, 'annual', 'zz_e2e_leave_b'
from public.staff_users where username='zz_e2e_rep_b1';

insert into public.work_schedules(work_date, end_date, plan_type, start_time, end_time, title, participant_ids, created_by, schedule_scope, approval_status, workflow_revision)
select current_date + v.offset, current_date + v.offset, v.plan_type, '09:00', '10:00',
       'zz_e2e_' || v.owner || '_' || v.plan_type, array[u.id], u.id, 'personal', 'PENDING_APPROVAL', 1
from (values
  ('rep_a1','business',20), ('rep_a1','event',21), ('rep_a1','work',22), ('rep_a2','business',25),
  ('rep_b1','business',23), ('rep_b1','event',24)
) v(owner,plan_type,offset)
join public.staff_users u on u.username='zz_e2e_' || v.owner;

commit;

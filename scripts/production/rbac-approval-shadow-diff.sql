-- Authorization-only shadow comparison. Status/revision/pending gates are intentionally ignored.
begin;

create or replace function pg_temp.legacy_leave_decision(actor uuid, request uuid)
returns boolean language sql stable as $$
  select coalesce(
    a.active and a.id <> l.requester_id and (
      ((l.end_date-l.start_date)+1 >= 3 and lower(r.code) = 'tong_bien_tap')
      or ((l.end_date-l.start_date)+1 < 3 and (
        lower(r.code) in ('admin','tong_bien_tap','pho_tong_bien_tap','phu_trach_phong_tri_su','phu_trach_phong_phong_vien','phu_trach_phong_bien_tap')
        or (lower(j.code) = 'truong_phong' and a.department_id is not distinct from l.department_id)
      ))
    ), false)
  from public.leave_requests l
  left join public.staff_users a on a.id=actor
  left join public.roles r on r.id=a.role_id
  left join public.job_titles j on j.id=a.job_title_id
  where l.id=request;
$$;

create or replace function pg_temp.legacy_plan_decision(actor uuid, plan uuid)
returns boolean language sql stable as $$
  with subject as (
    select w.created_by,
      (select u.department_id from public.staff_users u where u.id=w.created_by and u.active=true) as department_id
    from public.work_schedules w where w.id=plan
  ), manager as (
    select d.manager_id
    from subject s join public.departments d on d.id=s.department_id and d.active=true
    join public.staff_users m on m.id=d.manager_id and m.active=true
  )
  select coalesce(a.active and a.id <> s.created_by and (
    lower(r.code) in ('admin','tong_bien_tap','pho_tong_bien_tap')
    or (m.manager_id=actor and a.department_id is not distinct from s.department_id)
  ), false)
  from subject s left join manager m on true
  left join public.staff_users a on a.id=actor
  left join public.roles r on r.id=a.role_id;
$$;

insert into public.departments(code,name,active)
values ('zz_rbac_shadow_a','zz_rbac_shadow_a',true),('zz_rbac_shadow_b','zz_rbac_shadow_b',true)
on conflict (code) do nothing;

create temporary table pg_temp.zz_rbac_shadow_users(key text primary key, id uuid) on commit drop;
insert into public.staff_users(full_name,username,email,password,role_id,job_title_id,department_id,active)
select 'zz_rbac_shadow_'||v.key, 'zz_rbac_shadow_'||v.key, 'zz_rbac_shadow_'||v.key||'@invalid.test',
       'zz_rbac_shadow', r.id, jt.id, d.id, true
from (values
  ('manager_a','nhan_vien','truong_phong','zz_rbac_shadow_a'),('ptbt_a','pho_tong_bien_tap','nhan_vien','zz_rbac_shadow_a'),('inactive_role_a','phu_trach_phong_bien_tap','nhan_vien','zz_rbac_shadow_a'),
  ('admin_a','admin','nhan_vien','zz_rbac_shadow_a'),('deputy_a','nhan_vien','pho_truong_phong','zz_rbac_shadow_a'),
  ('staff_a1','nhan_vien','nhan_vien','zz_rbac_shadow_a'),('staff_a2','nhan_vien','nhan_vien','zz_rbac_shadow_a'),
  ('staff_a_inactive','nhan_vien','nhan_vien','zz_rbac_shadow_a'),('staff_b1','nhan_vien','nhan_vien','zz_rbac_shadow_b')
) v(key,role_code,job_code,department_code)
join public.roles r on lower(r.code)=v.role_code join public.job_titles jt on lower(jt.code)=v.job_code
join public.departments d on d.code=v.department_code
returning username,id;
insert into pg_temp.zz_rbac_shadow_users(key,id)
select regexp_replace(username,'^zz_rbac_shadow_',''), id from public.staff_users where username like 'zz_rbac_shadow_%';

insert into public.leave_requests(requester_id,department_id,start_date,end_date,start_period,end_period,leave_type,reason)
select u.id, s.department_id,
       current_date + case when v.key='a_weekend' then ((5 - extract(isodow from current_date)::int + 7) % 7) else v.offset_days end,
       current_date + case when v.key='a_weekend' then ((5 - extract(isodow from current_date)::int + 7) % 7) + v.span_days else v.offset_days + v.span_days end,
       v.start_period, v.end_period, 'annual', 'zz_rbac_shadow_leave_'||v.key
from (values
  ('a_morning','staff_a1',1,0,'morning','morning'),('a_one','staff_a1',3,0,'full','full'),('a_two','staff_a1',5,1,'full','full'),
  ('a_three','staff_a2',8,2,'full','full'),('a_four','staff_a2',12,3,'full','full'),('a_weekend','staff_a2',19,3,'full','full'),
  ('b_one','staff_b1',25,0,'full','full'),('inactive','staff_a_inactive',28,0,'full','full'),('inactive_role','inactive_role_a',31,0,'full','full')
) v(key,user_key,offset_days,span_days,start_period,end_period)
join pg_temp.zz_rbac_shadow_users u on u.key=v.user_key join public.staff_users s on s.id=u.id;

insert into public.work_schedules(work_date,end_date,plan_type,start_time,end_time,title,participant_ids,created_by,schedule_scope,approval_status,workflow_revision)
select current_date + v.offset_days, current_date + v.offset_days, v.plan_type, '09:00','10:00',
       'zz_rbac_shadow_plan_'||v.user_key||'_'||v.plan_type, array[u.id], u.id, 'personal','PENDING_APPROVAL',1
from (values
  ('staff_a1',1,'business'),('staff_a1',2,'event'),('staff_a1',3,'work'),('staff_a2',4,'business'),('staff_a2',5,'event'),('staff_a2',6,'work'),
  ('staff_b1',7,'business'),('staff_b1',8,'event'),('staff_b1',9,'work'),('staff_a_inactive',10,'business'),('staff_a_inactive',11,'event'),('staff_a_inactive',12,'work')
) v(user_key,offset_days,plan_type) join pg_temp.zz_rbac_shadow_users u on u.key=v.user_key;

update public.staff_users set active=false where id=(select id from pg_temp.zz_rbac_shadow_users where key='staff_a_inactive');

create temporary table pg_temp.zz_rbac_shadow_rows(kind text, actor uuid, subject uuid, dimension text, legacy boolean, new_value boolean, class text) on commit drop;
insert into pg_temp.zz_rbac_shadow_rows
select 'leave',a.id,l.requester_id,(l.end_date-l.start_date+1)::text,
       coalesce(pg_temp.legacy_leave_decision(a.id,l.id),false),
       coalesce(public.approval_review_basis(a.id,'leave.approve',l.requester_id,l.department_id,l.end_date-l.start_date+1) is not null,false), null
from public.staff_users a cross join public.leave_requests l where a.active and l.status='pending';
insert into pg_temp.zz_rbac_shadow_rows
select 'plan',a.id,w.created_by,w.plan_type,coalesce(pg_temp.legacy_plan_decision(a.id,w.id),false),
       coalesce(case when w.approval_status='PENDING_APPROVAL' then exists(select 1 from public.api_list_reviewable_personal_plans(a.id) x where x.id=w.id)
         when w.plan_type in ('business','event') then public.approval_review_basis(a.id,case w.plan_type when 'business' then 'schedule.business.approve' else 'schedule.event.approve' end,w.created_by,(select u.department_id from public.staff_users u where u.id=w.created_by and u.active=true)) is not null
         else false end,false, null)
from public.staff_users a cross join public.work_schedules w where a.active and w.schedule_scope='personal'
  and (w.approval_status='PENDING_APPROVAL' or w.plan_type in ('business','event'));

update pg_temp.zz_rbac_shadow_rows s
set class = case
  when s.legacy and not s.new_value and coalesce(r.active, false) = false then 'EXPECTED_INACTIVE_ROLE'
  when s.legacy and not s.new_value and lower(j.code) = 'pho_truong_phong' then 'EXPECTED_D6_PHO_TP_JOB'
  when not s.legacy and s.new_value then 'SECURITY_CRITICAL'
  when s.legacy and not s.new_value then 'UNEXPECTED_RESTRICTIVE'
end
from public.staff_users a left join public.roles r on r.id=a.role_id left join public.job_titles j on j.id=a.job_title_id
where s.actor=a.id and s.legacy is distinct from s.new_value;

update pg_temp.zz_rbac_shadow_rows set kind=class||'|'||kind where class is not null;

select 'SHADOW_TOTAL='||count(*) from pg_temp.zz_rbac_shadow_rows;
select 'SHADOW_MISMATCH='||count(*) from pg_temp.zz_rbac_shadow_rows where legacy is distinct from new_value;
select 'SHADOW_LIST_MISMATCH='||(
  (select count(*) from public.work_schedules w cross join public.staff_users a where a.active and w.schedule_scope='personal' and w.approval_status='PENDING_APPROVAL' and w.plan_type in ('business','event')
    and (exists(select 1 from public.api_list_reviewable_personal_plans(a.id) x where x.id=w.id) is distinct from (public.approval_review_basis(a.id,case w.plan_type when 'business' then 'schedule.business.approve' else 'schedule.event.approve' end,w.created_by,(select u.department_id from public.staff_users u where u.id=w.created_by and u.active=true)) is not null)))
  + (select count(*) from public.leave_requests l cross join public.staff_users a where a.active and l.status='pending'
    and (exists(select 1 from public.api_list_reviewable_leave_requests(a.id,'2000-01-01','2100-12-31') x where x.id=l.id) is distinct from (public.approval_review_basis(a.id,'leave.approve',l.requester_id,l.department_id,l.end_date-l.start_date+1) is not null)))
);
select 'SHADOW_ROW|'||concat_ws('|',coalesce(kind,'∅'),coalesce(actor::text,'∅'),coalesce(subject::text,'∅'),coalesce(dimension,'∅'),coalesce(legacy::text,'∅'),coalesce(new_value::text,'∅'))
from pg_temp.zz_rbac_shadow_rows where legacy is distinct from new_value order by kind,actor,subject,dimension;
select 'SHADOW_CLASS_EXPECTED_INACTIVE_ROLE='||count(*) from pg_temp.zz_rbac_shadow_rows where class='EXPECTED_INACTIVE_ROLE';
select 'SHADOW_CLASS_EXPECTED_D6_PHO_TP_JOB='||count(*) from pg_temp.zz_rbac_shadow_rows where class='EXPECTED_D6_PHO_TP_JOB';
select 'SHADOW_CLASS_SECURITY_CRITICAL='||count(*) from pg_temp.zz_rbac_shadow_rows where class='SECURITY_CRITICAL';
select 'SHADOW_CLASS_UNEXPECTED_RESTRICTIVE='||count(*) from pg_temp.zz_rbac_shadow_rows where class='UNEXPECTED_RESTRICTIVE';
rollback;

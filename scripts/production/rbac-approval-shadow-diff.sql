-- Authorization-only shadow comparison. Status/revision/pending gates are intentionally ignored.
-- D-6 (job pho_truong_phong) is the only intended difference; P1 shows 0 such users.
-- Schema checked against: fixture-tables-schema.sql, fixture-tables-constraints.sql,
-- fixture-trigger-functions.sql (staff_users, departments, leave_requests,
-- work_schedules, user_permission_grants, roles, job_titles).
begin;

create or replace function pg_temp.legacy_leave_decision(actor uuid, request uuid)
returns boolean language sql stable as $$
  select case when (l.end_date-l.start_date)+1 >= 3
    then lower(r.code) = 'tong_bien_tap'
    else lower(r.code) in ('admin','tong_bien_tap','pho_tong_bien_tap')
      or (lower(r.code) in ('phu_trach_phong_tri_su','phu_trach_phong_phong_vien','phu_trach_phong_bien_tap') and a.department_id is not distinct from l.department_id)
      or (lower(j.code) in ('truong_phong','pho_truong_phong') and a.department_id is not distinct from l.department_id)
  end
  from public.leave_requests l
  join public.staff_users a on a.id=actor and a.active
  join public.roles r on r.id=a.role_id
  left join public.job_titles j on j.id=a.job_title_id
  where l.id=request and a.id<>l.requester_id;
$$;

create or replace function pg_temp.legacy_plan_decision(actor uuid, plan uuid)
returns boolean language sql stable as $$
  select lower(r.code) in ('admin','tong_bien_tap','pho_tong_bien_tap')
    or exists (select 1 from public.departments d where d.id=c.department_id and d.active and d.manager_id=actor and a.department_id is not distinct from c.department_id)
  from public.work_schedules w
  join public.staff_users c on c.id=w.created_by
  join public.staff_users a on a.id=actor and a.active
  join public.roles r on r.id=a.role_id
  where w.id=plan and a.id<>w.created_by;
$$;

-- Ensure a deterministic cross-product even when production has no pending leave rows.
insert into public.departments(code,name,active) values ('zz_rbac_shadow_a','zz_rbac_shadow_a',true),('zz_rbac_shadow_b','zz_rbac_shadow_b',true) on conflict (code) do nothing;
insert into public.staff_users(full_name,email,password,role_id,department_id,active)
select 'zz_rbac_shadow_'||x.k, x.k||'@invalid.test','zz_rbac_shadow',(select id from public.roles where code=x.role), (select id from public.departments where code=x.dep), true
from (values ('tbt','tong_bien_tap','zz_rbac_shadow_a'),('staff','nhan_vien','zz_rbac_shadow_a'),('other','nhan_vien','zz_rbac_shadow_b')) x(k,role,dep)
where not exists (select 1 from public.staff_users where email=x.k||'@invalid.test');
insert into public.leave_requests(requester_id,department_id,start_date,end_date,reason)
select u.id,u.department_id,current_date+x.n,current_date+x.n+x.n-1,'zz_rbac_shadow_'||x.n
from (values (1),(2),(3),(4)) x(n) cross join lateral (select id,department_id from public.staff_users where email='staff@invalid.test') u
where not exists (select 1 from public.leave_requests l where l.reason='zz_rbac_shadow_'||x.n);
insert into public.work_schedules(work_date,end_date,plan_type,start_time,end_time,title,participant_ids,created_by,schedule_scope,approval_status,workflow_revision)
select current_date, current_date, x.t, '09:00','10:00','zz_rbac_shadow_'||x.t,array[u.id],u.id,'personal','PENDING_APPROVAL',1
from (values ('business'),('event'),('work')) x(t) cross join lateral (select id from public.staff_users where email='staff@invalid.test') u
where not exists (select 1 from public.work_schedules w where w.title='zz_rbac_shadow_'||x.t);

create temporary table pg_temp.zz_rbac_shadow_rows(kind text, actor uuid, actor_role text, actor_job text, subject_role text, dimension text, legacy boolean, new_value boolean) on commit drop;
insert into pg_temp.zz_rbac_shadow_rows
select 'leave',a.id,r.code,j.code,sr.code,(l.end_date-l.start_date+1)::text,
       coalesce(pg_temp.legacy_leave_decision(a.id,l.id),false),
       public.approval_review_basis(a.id,'leave.approve',l.requester_id,l.department_id,l.end_date-l.start_date+1) is not null
from public.staff_users a join public.roles r on r.id=a.role_id left join public.job_titles j on j.id=a.job_title_id cross join public.leave_requests l join public.staff_users s on s.id=l.requester_id join public.roles sr on sr.id=s.role_id where a.active;
insert into pg_temp.zz_rbac_shadow_rows
select 'plan',a.id,r.code,j.code,sr.code,w.plan_type,
       coalesce(pg_temp.legacy_plan_decision(a.id,w.id),false),
       case when w.plan_type='work' then pg_temp.legacy_plan_decision(a.id,w.id)
            else public.approval_review_basis(a.id,case w.plan_type when 'business' then 'schedule.business.approve' else 'schedule.event.approve' end,w.created_by,c.department_id) is not null end
from public.staff_users a join public.roles r on r.id=a.role_id left join public.job_titles j on j.id=a.job_title_id cross join public.work_schedules w join public.staff_users c on c.id=w.created_by join public.roles sr on sr.id=c.role_id where a.active and w.schedule_scope='personal';

select 'SHADOW_TOTAL='||count(*) from pg_temp.zz_rbac_shadow_rows;
select 'SHADOW_MISMATCH='||count(*) from pg_temp.zz_rbac_shadow_rows where legacy is distinct from new_value;
select 'SHADOW_ROW|'||kind||'|'||actor_role||'|'||coalesce(actor_job,'')||'|'||subject_role||'|'||dimension||'|'||legacy||'|'||new_value from pg_temp.zz_rbac_shadow_rows where legacy is distinct from new_value order by kind,actor_role,dimension;
rollback;

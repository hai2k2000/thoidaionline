-- Disposable fixture: every mutation is rolled back.
begin;
create temporary table zz_self_users (key text primary key, id uuid not null) on commit drop;
create temporary table zz_self_plans (key text primary key, id uuid not null) on commit drop;
insert into public.departments(code,name,active) values ('zz_self_approve','zz_self_approve',true);
insert into public.staff_users(full_name,username,email,password,role_id,department_id,job_title_id,active)
select 'zz_self_'||x.key,'zz_self_'||x.key,x.key||'@zz-self.invalid','fixture-only',
 (select id from public.roles where code=x.role_code),
 (select id from public.departments where code='zz_self_approve'),
 (select id from public.job_titles where code=x.job_code),true
from (values ('head','nhan_vien','truong_phong'),('allow','nhan_vien','nhan_vien'),
 ('plain','nhan_vien','nhan_vien'),('tbt','tong_bien_tap','tong_bien_tap')) x(key,role_code,job_code);
insert into zz_self_users select substring(username from 9),id from public.staff_users where username in ('zz_self_head','zz_self_allow','zz_self_plain','zz_self_tbt');
-- Ensure a restored role grant cannot make the no-rights fixture accidentally privileged.
delete from public.role_permission_grants where role_id=(select id from public.roles where code='nhan_vien')
 and permission_id in (select id from public.permissions where code in ('schedule.event.approve','schedule.business.approve'));
insert into public.user_permission_grants(user_id,permission_id,scope,effect,created_by)
select (select id from zz_self_users where key='allow'),id,'department','allow',(select id from zz_self_users where key='tbt')
from public.permissions where code='schedule.event.approve';
insert into public.work_schedules(work_date,end_date,plan_type,start_time,end_time,title,participant_ids,created_by,schedule_scope,approval_status,workflow_revision)
select current_date,current_date,x.plan_type,'09:00','10:00','zz_self_'||x.key,array[u.id],u.id,'personal','PENDING_APPROVAL',1
from (values ('head_event','head','event'),('allow_event','allow','event'),('plain_event','plain','event'),
 ('deny_event','head','event'),('other_event','plain','event'),('head_business','head','business'),
 ('head_work','head','work'),('head_reject','head','event')) x(key,user_key,plan_type)
join zz_self_users u on u.key=x.user_key;
insert into zz_self_plans select substring(title from 9),id from public.work_schedules where title in
 ('zz_self_head_event','zz_self_allow_event','zz_self_plain_event','zz_self_deny_event','zz_self_other_event','zz_self_head_business','zz_self_head_work','zz_self_head_reject');

do $$ declare h uuid; a uuid; n uuid; t uuid; d uuid; v public.work_schedules; k text; begin
 select id into h from zz_self_users where key='head';
 select id into a from zz_self_users where key='allow';
 select id into n from zz_self_users where key='plain';
 select id into t from zz_self_users where key='tbt';
 select id into d from public.departments where code='zz_self_approve';
 if (select count(*) from zz_self_users)<>4 or (select count(*) from zz_self_plans)<>8 then raise exception 'fixture incomplete'; end if;
 if not exists(select 1 from public.departments where id=d and manager_id=h) then raise exception 'manager trigger fixture failed'; end if;
 if not exists(select 1 from public.approval_effective_scopes(h,'schedule.event.approve') where source='structural' and 'department'=any(scopes)) then raise exception 'head scope missing'; end if;
 if not exists(select 1 from public.approval_effective_scopes(a,'schedule.event.approve') where source='user_allow' and scopes=array['department']) then raise exception 'allow scope missing'; end if;
 if not exists(select 1 from public.approval_effective_scopes(n,'schedule.event.approve') where source='none' and cardinality(scopes)=0) then raise exception 'plain fixture has rights'; end if;
 foreach k in array array['head_event','head_business','head_work','head_reject','allow_event'] loop
   if not exists(select 1 from public.api_list_reviewable_personal_plans(case when k='allow_event' then a else h end) where id=(select id from zz_self_plans where key=k)) then raise exception 'own pending plan absent: %',k; end if;
   v:=public.api_review_personal_work_schedule(case when k='allow_event' then a else h end,(select id from zz_self_plans where key=k),case when k='head_reject' then 'reject' else 'approve' end,'fixture review',1);
   if v.approval_status is distinct from (case when k='head_reject' then 'REJECTED' else 'APPROVED' end) or v.reviewed_by is distinct from v.created_by or v.workflow_revision<>2 then raise exception 'self review failed: %',k; end if;
   if not exists(select 1 from public.audit_logs where entity_id=v.id and action=case when k='head_reject' then 'reject_personal_plan' else 'approve_personal_plan' end and new_data->>'self_approval'='true' and new_data->>'approval_basis' is not null) then raise exception 'self audit missing: %',k; end if;
 end loop;
 if exists(select 1 from public.api_list_reviewable_personal_plans(n) where id=(select id from zz_self_plans where key='plain_event')) then raise exception 'plain list unexpectedly allowed'; end if;
 begin
   perform public.api_review_personal_work_schedule(n,(select id from zz_self_plans where key='plain_event'),'approve','',1);
   raise exception 'plain self approval unexpectedly allowed';
 exception when sqlstate '42501' then null; end;
 -- Deny overrides an already-proven structural department grant.
 insert into public.user_permission_grants(user_id,permission_id,scope,effect,created_by)
 select h,id,'department','deny',t from public.permissions where code='schedule.event.approve';
 if not exists(select 1 from public.approval_effective_scopes(h,'schedule.event.approve') where source='user_deny' and cardinality(scopes)=0) then raise exception 'deny fixture missing'; end if;
 if exists(select 1 from public.api_list_reviewable_personal_plans(h) where id=(select id from zz_self_plans where key='deny_event')) then raise exception 'denied plan listed'; end if;
 begin
   perform public.api_review_personal_work_schedule(h,(select id from zz_self_plans where key='deny_event'),'approve','',1);
   raise exception 'denied self approval unexpectedly allowed';
 exception when sqlstate '42501' then null; end;
 -- Demonstrate leave rights exist, so the denial specifically tests self review.
 if public.approval_review_basis(h,'leave.approve',n,d,1) is null then raise exception 'leave fixture lacks rights'; end if;
 if public.approval_review_basis(h,'leave.approve',h,d,1) is not null then raise exception 'leave self basis allowed'; end if;
 begin
   perform public.approval_assert_can_review(h,'leave.approve',h,d,1);
   raise exception 'leave self approval unexpectedly allowed';
 exception when sqlstate '42501' then null; end;
 if public.approval_review_basis(t,'schedule.event.approve',n,d) is null then raise exception 'TBT fixture lacks rights'; end if;
 v:=public.api_review_personal_work_schedule(t,(select id from zz_self_plans where key='other_event'),'approve','',1);
 if v.approval_status is distinct from 'APPROVED' or v.reviewed_by is distinct from t then raise exception 'other review failed'; end if;
 if exists(select 1 from public.audit_logs where entity_id=v.id and new_data ? 'self_approval') then raise exception 'other audit changed'; end if;
 raise notice 'SELF_APPROVE_BEHAVIOUR=PASS';
end $$;
rollback;

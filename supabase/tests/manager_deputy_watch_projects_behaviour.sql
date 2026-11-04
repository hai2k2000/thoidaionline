\set ON_ERROR_STOP on
begin;
do $test$
declare
 d uuid; missing_d uuid; manager_id uuid; worker_id uuid; missing_worker uuid;
 t uuid; p uuid; deputy uuid; suffix text:=replace(gen_random_uuid()::text,'-','');
begin
 insert into public.departments(code,name,active) values('zz_mw_'||suffix,'Managed fixture',true) returning id into d;
 insert into public.departments(code,name,active) values('zz_mw_missing_'||suffix,'No manager fixture',true) returning id into missing_d;
 insert into public.staff_users(full_name,username,password,role_id,department_id)
 values('Manager','zz_mw_manager_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),d) returning id into manager_id;
 insert into public.staff_users(full_name,username,password,role_id,department_id)
 values('Worker','zz_mw_worker_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),d) returning id into worker_id;
 insert into public.staff_users(full_name,username,password,role_id,department_id)
 values('No manager worker','zz_mw_missing_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),missing_d) returning id into missing_worker;
 insert into public.staff_users(full_name,username,password,role_id,department_id,job_title_id)
 values('Deputy','zz_deputy_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),d,(select id from public.job_titles where code='pho_truong_phong')) returning id into deputy;
 update public.departments set manager_id=(select id from public.staff_users where username='zz_mw_manager_'||suffix) where id=d;
 insert into public.tasks(title,created_by,department_id,task_type,task_category,plan_period,status)
 values('Manager watch fixture',manager_id,d,'assigned','regular','ad_hoc','new') returning id into t;
 insert into public.task_assignees(task_id,user_id,assignment_role,status) values(t,worker_id,'assignee','todo');
 set constraints all immediate;
 if not exists(select 1 from public.task_assignees a where a.task_id=t and a.user_id=manager_id and a.assignment_role='watcher') then raise exception 'Manager watcher missing'; end if;
 insert into public.task_assignees(task_id,user_id,assignment_role,status) values(t,missing_worker,'assignee','todo');
 if (select count(*) from public.task_assignees a where a.task_id=t and a.assignment_role='watcher')<>2 then raise exception 'Unexpected watcher'; end if;
 begin
  update public.task_assignees set assignment_role='owner' where task_id=t and user_id=missing_worker;
    set constraints all immediate;
  raise exception 'Owner missing manager accepted';
 exception when invalid_parameter_value then null;
 end;
 insert into public.projects(code,name,host_department_id,created_by) values('ZZ-MW-'||suffix,'Project fixture',d,manager_id) returning id into p;
 insert into public.project_members(project_id,user_id,role,added_by) values(p,worker_id,'lead',worker_id) on conflict do nothing;
 insert into public.tasks(title,created_by,department_id,task_type,task_category,plan_period,status,project_id,reviewer_id)
 values('Project unchanged',manager_id,d,'assigned','regular','ad_hoc','new',p,worker_id) returning id into t;
 insert into public.task_assignees(task_id,user_id,assignment_role,status) values(t,worker_id,'assignee','todo'),(t,missing_worker,'owner','todo');
 if not exists(select 1 from public.task_assignees a where a.task_id=t and a.user_id=deputy and a.assignment_role='watcher') then raise exception 'Project deputy watcher missing'; end if;
 if not exists(select 1 from public.task_assignees a where a.task_id=t and a.user_id=manager_id and a.assignment_role='watcher') then raise exception 'Project manager watcher missing'; end if;
 begin
  perform public.api_assert_task_action(deputy,t,'review');
  raise exception 'Non-member watcher can review';
 exception when insufficient_privilege then null; end;
 begin
  perform public.api_assert_task_action(deputy,t,'report');
  raise exception 'Watcher can report';
 exception when insufficient_privilege then null; end;
 begin
  perform public.api_assert_project_library(deputy,p,false);
  raise exception 'Watcher can read project library';
 exception when insufficient_privilege then null; end;
 if public.api_project_can_assign(deputy,p) then raise exception 'Watcher can assign project tasks'; end if;
 if (select count(*) from public.department_watch_leaders(d))<>2 then raise exception 'Leader helper mismatch'; end if;
end $test$;
rollback;

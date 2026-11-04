\set ON_ERROR_STOP on
begin;
do $test$
declare
 d uuid; missing_d uuid; manager_id uuid; worker_id uuid; missing_worker uuid;
 t uuid; p uuid; suffix text:=replace(gen_random_uuid()::text,'-','');
begin
 insert into public.departments(code,name,active) values('zz_mw_'||suffix,'Managed fixture',true) returning id into d;
 insert into public.departments(code,name,active) values('zz_mw_missing_'||suffix,'No manager fixture',true) returning id into missing_d;
 insert into public.staff_users(full_name,username,password,role_id,department_id)
 values('Manager','zz_mw_manager_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),d) returning id into manager_id;
 insert into public.staff_users(full_name,username,password,role_id,department_id)
 values('Worker','zz_mw_worker_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),d) returning id into worker_id;
 insert into public.staff_users(full_name,username,password,role_id,department_id)
 values('No manager worker','zz_mw_missing_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),missing_d) returning id into missing_worker;
 update public.departments set manager_id=(select id from public.staff_users where username='zz_mw_manager_'||suffix) where id=d;
 insert into public.tasks(title,created_by,department_id,task_type,task_category,plan_period,status)
 values('Manager watch fixture',manager_id,d,'assigned','regular','ad_hoc','new') returning id into t;
 insert into public.task_assignees(task_id,user_id,assignment_role,status) values(t,worker_id,'assignee','todo');
 set constraints all immediate;
 if not exists(select 1 from public.task_assignees a where a.task_id=t and a.user_id=manager_id and a.assignment_role='watcher') then raise exception 'Manager watcher missing'; end if;
 insert into public.task_assignees(task_id,user_id,assignment_role,status) values(t,missing_worker,'assignee','todo');
 if (select count(*) from public.task_assignees a where a.task_id=t and a.assignment_role='watcher')<>1 then raise exception 'Unexpected watcher'; end if;
 begin
  update public.task_assignees set assignment_role='owner' where task_id=t and user_id=missing_worker;
    set constraints all immediate;
  raise exception 'Owner missing manager accepted';
 exception when invalid_parameter_value then null;
 end;
 insert into public.projects(code,name,host_department_id,created_by) values('ZZ-MW-'||suffix,'Project fixture',d,manager_id) returning id into p;
 insert into public.project_members(project_id,user_id,role,added_by) values(p,manager_id,'lead',manager_id) on conflict do nothing;
 insert into public.tasks(title,created_by,department_id,task_type,task_category,plan_period,status,project_id,reviewer_id)
 values('Project unchanged',manager_id,d,'assigned','regular','ad_hoc','new',p,manager_id) returning id into t;
 insert into public.task_assignees(task_id,user_id,assignment_role,status) values(t,worker_id,'assignee','todo'),(t,missing_worker,'owner','todo');
 if exists(select 1 from public.task_assignees a where a.task_id=t and a.assignment_role='watcher') then raise exception 'Project watcher added'; end if;
end $test$;
rollback;

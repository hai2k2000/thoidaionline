-- Run with psql -X -v ON_ERROR_STOP=1 -f supabase/tests/projects_v1_behaviour.sql
-- against a disposable database containing all migrations. All fixtures roll back.
begin;
create function pg_temp.expect_state(p_sql text,p_state text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if sqlstate=p_state then return; end if;
    raise;
  end;
  raise exception 'Expected SQLSTATE % for %',p_state,p_sql;
end $$;

do $$
declare
  host_id uuid; other_id uuid; creator uuid; lead_id uuid; member_id uuid;
  second_lead uuid; tbt_id uuid; ctv_id uuid; outsider uuid; inactive_id uuid; p public.projects; t public.tasks;
  employee_role uuid; ctv_job uuid;
begin
  insert into public.departments(code,name) values('zz_projects_host','Project host') returning id into host_id;
  insert into public.departments(code,name) values('zz_projects_other','Other department') returning id into other_id;
  select id into employee_role from public.roles where code='nhan_vien';
  if employee_role is null then raise exception 'Fixture needs nhan_vien role'; end if;
  select id into ctv_job from public.job_titles where code='ctv';
  if ctv_job is null then raise exception 'Fixture needs ctv job title'; end if;
  insert into public.staff_users(full_name,username,password,role_id,department_id)
  values('Project admin','zz_projects_admin','test-only',(select id from public.roles where code='admin'),host_id) returning id into creator;
  insert into public.staff_users(full_name,username,password,role_id,department_id)
  values('Project lead','zz_projects_lead','test-only',employee_role,other_id) returning id into lead_id;
  insert into public.staff_users(full_name,username,password,role_id,department_id)
  values('Project member','zz_projects_member','test-only',employee_role,host_id) returning id into member_id;
  insert into public.staff_users(full_name,username,password,role_id,department_id,job_title_id)
  values('Project CTV','zz_projects_ctv','test-only',employee_role,other_id,ctv_job) returning id into ctv_id;
  insert into public.staff_users(full_name,username,password,role_id,department_id)
  values('Project outsider','zz_projects_outsider','test-only',employee_role,host_id) returning id into outsider;
  insert into public.staff_users(full_name,username,password,role_id,department_id,active)
  values('Inactive','zz_projects_inactive','test-only',employee_role,other_id,false) returning id into inactive_id;

  insert into public.staff_users(full_name,username,password,role_id,department_id)
  values('Second lead','zz_projects_lead2','test-only',employee_role,other_id) returning id into second_lead;
  insert into public.staff_users(full_name,username,password,role_id,department_id)
  values('TBT lead','zz_projects_tbt','test-only',(select id from public.roles where code='tong_bien_tap'),other_id) returning id into tbt_id;
  p := public.api_create_project(creator,'ZZ-PROJECT','Project test',null,host_id,array[lead_id]);
  perform public.api_set_project_member(lead_id,p.id,member_id,'member');
  perform public.api_set_project_member(lead_id,p.id,ctv_id,'member');
  perform pg_temp.expect_state(format('select public.api_create_project(%L,''ZZ-DENIED'',''Denied'',null,%L,array[%L::uuid])',member_id,host_id,member_id),'42501');
  perform pg_temp.expect_state(format('select public.api_assign_project_task(%L,%L,''Task'',''Requirements'',%L,%L,current_date,''17:00'')',member_id,p.id,ctv_id,lead_id),'42501');
  perform pg_temp.expect_state(format('select public.api_assign_project_task(%L,%L,''Task'',''Requirements'',%L,%L,current_date,''17:00'')',lead_id,p.id,outsider,lead_id),'22023');
  perform pg_temp.expect_state(format('select public.api_assign_project_task(%L,%L,''Task'',''Requirements'',%L,%L,current_date,''17:00'')',lead_id,p.id,ctv_id,member_id),'22023');
  perform pg_temp.expect_state(format('select public.api_set_project_member(%L,%L,%L,''member'',true)',lead_id,p.id,lead_id),'23514');
  perform pg_temp.expect_state(format('select public.api_set_project_member(%L,%L,%L,''member'',false)',lead_id,p.id,lead_id),'23514');
  perform pg_temp.expect_state(format('select public.api_set_project_member(%L,%L,%L,''member'',false)',lead_id,p.id,inactive_id),'22023');

  t := public.api_assign_project_task(lead_id,p.id,'CTV assignee','Requirements',ctv_id,null,current_date,'17:00',null,array[member_id],array[member_id],'high');
  set constraints all immediate;
  if t.project_id<>p.id or t.department_id<>host_id or t.reviewer_id<>lead_id or t.assignee_id<>ctv_id or t.priority<>'high' then raise exception 'Project task mapping failed'; end if;
  if exists(select 1 from public.task_assignees where task_id=t.id and user_id not in (ctv_id,member_id)) then raise exception 'Unexpected automatic watcher'; end if;
  perform public.api_assert_task_action(member_id,t.id,'comment');
  perform public.api_assert_task_action(lead_id,t.id,'review');
  perform pg_temp.expect_state(format('select public.api_assert_task_action(%L,%L,''review'')',member_id,t.id),'42501');
  perform pg_temp.expect_state(format('select public.api_assert_task_action(%L,%L,''review'')',creator,t.id),'42501');
  t := public.api_assign_project_task(lead_id,p.id,'CTV collaborator','Requirements',member_id,lead_id,current_date,'17:00',null,array[ctv_id]);
  if not exists(select 1 from public.task_assignees where task_id=t.id and user_id=ctv_id and assignment_role='assignee') then raise exception 'Cross-department CTV collaborator missing'; end if;
  perform pg_temp.expect_state(format('select public.api_assign_project_task(%L,%L,''Task'',''Requirements'',%L,%L,current_date,''17:00'',null,array[%L::uuid])',lead_id,p.id,ctv_id,lead_id,outsider),'22023');
  perform pg_temp.expect_state(format('select public.api_assign_project_task(%L,%L,''Task'',''Requirements'',%L,%L,current_date,''17:00'',null,''{}''::uuid[],array[%L::uuid])',lead_id,p.id,ctv_id,lead_id,outsider),'22023');
  perform public.api_set_project_member(lead_id,p.id,second_lead,'lead');
  perform public.api_set_project_member(lead_id,p.id,tbt_id,'lead');
  update public.tasks set status='pending_review' where id=t.id;
  t := public.api_review_task_completion(second_lead,t.id,'reject','Please revise');
  if t.status<>'rejected' then raise exception 'Second lead could not reject'; end if;
  update public.tasks set status='pending_review' where id=t.id;
  t := public.api_review_task_completion(tbt_id,t.id,'approve',null);
  if t.status<>'done' then raise exception 'TBT project lead could not approve'; end if;
  perform public.api_close_project(lead_id,p.id);
  perform pg_temp.expect_state(format('select public.api_assign_project_task(%L,%L,''Task'',''Requirements'',%L,%L,current_date,''17:00'')',lead_id,p.id,ctv_id,lead_id),'42501');
  if not exists(select 1 from public.audit_logs where entity_id=p.id and action='close') then raise exception 'Project audit missing'; end if;
end $$;

do $$ declare fn regprocedure; tab text; role_name text; begin
 foreach tab in array array['projects','project_members'] loop
   if not (select relrowsecurity from pg_class where oid=('public.'||tab)::regclass) then raise exception 'RLS disabled: %',tab; end if;
   foreach role_name in array array['anon','authenticated'] loop
     if has_table_privilege(role_name,'public.'||tab,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'Direct table access: % %',role_name,tab; end if;
   end loop;
 end loop;
 for fn in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in ('api_create_project','api_update_project','api_set_project_member','api_close_project','api_assign_project_task','api_project_actor_can_create','api_project_is_lead') loop
   if has_function_privilege('anon',fn,'EXECUTE') or has_function_privilege('authenticated',fn,'EXECUTE') or not has_function_privilege('service_role',fn,'EXECUTE') then raise exception 'Bad RPC ACL: %',fn; end if;
 end loop;
end $$;
rollback;

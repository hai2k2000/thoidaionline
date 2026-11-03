-- Run with psql -X -v ON_ERROR_STOP=1 -f supabase/tests/projects_v1_1_behaviour.sql
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
  employee_role uuid; lead_job uuid; ctv_job uuid; f public.project_library_folders; child public.project_library_folders; item public.project_library_items; auto_item public.project_library_items; attachment uuid;
  fixture_suffix text := replace(gen_random_uuid()::text,'-','');
begin
  insert into public.departments(code,name) values('zz_projects_host_'||fixture_suffix,'Project host') returning id into host_id;
  insert into public.departments(code,name) values('zz_projects_other_'||fixture_suffix,'Other department') returning id into other_id;
  select id into employee_role from public.roles where code='nhan_vien';
  if employee_role is null then raise exception 'Fixture needs nhan_vien role'; end if;
  select id into lead_job from public.job_titles where code='truong_phong' and active;
  if lead_job is null then raise exception 'Fixture needs truong_phong job title'; end if;
  -- ctv is a fixture-only catalog value; production migrations do not seed it.
  insert into public.job_titles(code,name,display_order,active)
  values('ctv','Project CTV '||fixture_suffix,999,true)
  on conflict do nothing;
  select id into ctv_job from public.job_titles where code='ctv' and active;
  if ctv_job is null then raise exception 'Fixture needs ctv job title'; end if;
  insert into public.staff_users(full_name,username,password,role_id,department_id)
  values('Project admin','zz_projects_admin_'||fixture_suffix,'test-only',(select id from public.roles where code='admin'),host_id) returning id into creator;
  -- The legacy recipient trigger requires a host-department manager/title.
  -- Staff insertion synchronizes manager_id from this title; do not set it manually.
  insert into public.staff_users(full_name,username,password,role_id,department_id,job_title_id)
  values('Project lead','zz_projects_lead_'||fixture_suffix,'test-only',employee_role,host_id,lead_job) returning id into lead_id;
  insert into public.staff_users(full_name,username,password,role_id,department_id)
  values('Project member','zz_projects_member_'||fixture_suffix,'test-only',employee_role,host_id) returning id into member_id;
  insert into public.staff_users(full_name,username,password,role_id,department_id,job_title_id)
  values('Project CTV','zz_projects_ctv_'||fixture_suffix,'test-only',employee_role,other_id,ctv_job) returning id into ctv_id;
  insert into public.staff_users(full_name,username,password,role_id,department_id)
  values('Project outsider','zz_projects_outsider_'||fixture_suffix,'test-only',employee_role,host_id) returning id into outsider;
  insert into public.staff_users(full_name,username,password,role_id,department_id,active)
  values('Inactive','zz_projects_inactive_'||fixture_suffix,'test-only',employee_role,other_id,false) returning id into inactive_id;

  insert into public.staff_users(full_name,username,password,role_id,department_id)
  values('Second lead','zz_projects_lead2_'||fixture_suffix,'test-only',employee_role,other_id) returning id into second_lead;
  insert into public.staff_users(full_name,username,password,role_id,department_id)
  values('TBT lead','zz_projects_tbt_'||fixture_suffix,'test-only',(select id from public.roles where code='tong_bien_tap'),other_id) returning id into tbt_id;
  p := public.api_create_project(creator,'ZZ-PROJECT-'||fixture_suffix,'Project test',null,host_id,array[lead_id]);
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
  update public.tasks set status='pending_review',completion_submitted_at=now() where id=t.id;
  -- Scores are unique per task; refresh the row even if a prior score survives review.
  insert into public.task_completion_scores(task_id,reviewer_id,requirement_results,requirement_score,collaboration_score,initiative_score)
  values(t.id,lead_id,'[]'::jsonb,0,20,20)
  on conflict (task_id) do update set
    reviewer_id=excluded.reviewer_id,requirement_results=excluded.requirement_results,
    requirement_score=excluded.requirement_score,collaboration_score=excluded.collaboration_score,
    initiative_score=excluded.initiative_score,updated_at=now();
  t := public.api_review_task_completion(second_lead,t.id,'reject','Please revise');
  if t.status<>'rejected' then raise exception 'Second lead could not reject'; end if;
  update public.tasks set status='pending_review',completion_submitted_at=now() where id=t.id;
  insert into public.task_completion_scores(task_id,reviewer_id,requirement_results,requirement_score,collaboration_score,initiative_score)
  values(t.id,lead_id,'[]'::jsonb,0,20,20)
  on conflict (task_id) do update set
    reviewer_id=excluded.reviewer_id,requirement_results=excluded.requirement_results,
    requirement_score=excluded.requirement_score,collaboration_score=excluded.collaboration_score,
    initiative_score=excluded.initiative_score,updated_at=now();
  t := public.api_review_task_completion(tbt_id,t.id,'approve',null);
  if t.status<>'done' then raise exception 'TBT project lead could not approve'; end if;
  -- Deputy can assign to CTV with a lead reviewer, but cannot review or manage members.
  perform public.api_set_project_member(lead_id,p.id,member_id,'deputy');
  t:=public.api_assign_project_task(member_id,p.id,'Deputy task','Requirements',ctv_id,tbt_id,current_date,'17:00');
  if t.reviewer_id<>tbt_id then raise exception 'Deputy reviewer mismatch'; end if;
  perform pg_temp.expect_state(format('select public.api_assert_task_action(%L,%L,''review'')',member_id,t.id),'42501');
  perform pg_temp.expect_state(format('select public.api_set_project_member(%L,%L,%L,''member'')',member_id,p.id,outsider),'42501');
  perform pg_temp.expect_state(format('select public.api_close_project(%L,%L)',member_id,p.id),'42501');
  update public.staff_users set role_id=(select id from public.roles where code='cong_tac_vien') where id=ctv_id;
  perform pg_temp.expect_state(format('select public.api_set_project_member(%L,%L,%L,''lead'')',lead_id,p.id,ctv_id),'22023');
  perform pg_temp.expect_state(format('select public.api_set_project_member(%L,%L,%L,''deputy'')',lead_id,p.id,ctv_id),'22023');
  perform pg_temp.expect_state(format('update public.staff_users set role_id=(select id from public.roles where code=''cong_tac_vien'') where id=%L',member_id),'22023');
  item:=public.api_add_project_library_item(ctv_id,p.id,null,'file','Manual file',null,null,'projects/'||p.id::text||'/'||ctv_id::text||'/fixture.pdf','fixture.pdf','application/pdf',12);
  perform public.api_get_project_library_file(ctv_id,p.id,item.id);
  perform pg_temp.expect_state(format('select public.api_add_project_library_item(%L,%L,null,''file'',''Forged'',null,null,''another-project/file.pdf'',''file.pdf'',''application/pdf'',12)',ctv_id,p.id),'22023');
  f:=public.api_create_project_library_folder(ctv_id,p.id,'Scripts',null);
  child:=public.api_create_project_library_folder(ctv_id,p.id,'Child',f.id);
  perform pg_temp.expect_state(format('select public.api_create_project_library_folder(%L,%L,''scripts'',null)',ctv_id,p.id),'23505');
  perform pg_temp.expect_state(format('select public.api_mutate_project_library_folder(%L,%L,%L,''move'',null,%L)',ctv_id,p.id,f.id,child.id),'22023');
  item:=public.api_add_project_library_item(ctv_id,p.id,f.id,'link','HTTPS link',null,'https://example.test/file');
  perform pg_temp.expect_state(format('select public.api_add_project_library_item(%L,%L,null,''link'',''bad'',null,''http://example.test'')',ctv_id,p.id),'23514');
  perform pg_temp.expect_state(format('select public.api_list_project_library(%L,%L)',outsider,p.id),'42501');
  perform public.api_list_project_library(creator,p.id);
  perform public.api_list_project_library(ctv_id,p.id,f.id);
  perform public.api_mutate_project_library_item(member_id,p.id,item.id,'move',null,child.id);
  perform public.api_set_project_member(lead_id,p.id,second_lead,'member');
  perform pg_temp.expect_state(format('select public.api_mutate_project_library_item(%L,%L,%L,''delete'')',second_lead,p.id,item.id),'42501');
  perform public.api_mutate_project_library_item(ctv_id,p.id,item.id,'rename','Renamed');
  perform public.api_mutate_project_library_item(ctv_id,p.id,item.id,'delete');
  if not exists(select 1 from public.project_library_items where id=item.id and deleted_at is not null) then raise exception 'Soft delete missing'; end if;
  -- Assignment, progress and completion uploads share task_attachments.
  insert into public.task_attachments(task_id,storage_path,file_name,mime_type,size_bytes,uploaded_by) values(t.id,t.id::text||'/fixture.pdf','fixture.pdf','application/pdf',12,ctv_id) returning id into attachment;
  select * into auto_item from public.project_library_items where source_attachment_id=attachment;
  if auto_item.id is null or auto_item.storage_path<>t.id::text||'/fixture.pdf' then raise exception 'Automatic filing missing'; end if;
  perform pg_temp.expect_state(format('select public.api_mutate_project_library_item(%L,%L,%L,''delete'')',lead_id,p.id,auto_item.id),'42501');
  perform pg_temp.expect_state(format('select public.api_mutate_project_library_item(%L,%L,%L,''move'',null,%L)',ctv_id,p.id,auto_item.id,f.id),'42501');
  perform public.api_mutate_project_library_item(tbt_id,p.id,auto_item.id,'move',null,f.id);
  perform public.api_get_project_library_file(ctv_id,p.id,auto_item.id);
  perform pg_temp.expect_state(format('select public.api_get_project_library_file(%L,%L,%L)',outsider,p.id,auto_item.id),'42501');
  perform pg_temp.expect_state(format('select public.api_mutate_project_library_folder(%L,%L,%L,''delete'')',ctv_id,p.id,f.id),'23514');
  select * into child from public.project_library_folders where project_id=p.id and system_key='task_files';
  perform pg_temp.expect_state(format('select public.api_mutate_project_library_folder(%L,%L,%L,''rename'',''Changed'')',lead_id,p.id,child.id),'42501');
  perform public.api_close_project(lead_id,p.id);
  perform pg_temp.expect_state(format('select public.api_assign_project_task(%L,%L,''Task'',''Requirements'',%L,%L,current_date,''17:00'')',lead_id,p.id,ctv_id,lead_id),'42501');
  if not exists(select 1 from public.audit_logs where entity_id=p.id and action='close') then raise exception 'Project audit missing'; end if;
end $$;

do $$ declare fn regprocedure; tab text; role_name text; begin
 foreach tab in array array['projects','project_members','project_library_folders','project_library_items'] loop
   if not (select relrowsecurity from pg_class where oid=('public.'||tab)::regclass) then raise exception 'RLS disabled: %',tab; end if;
   foreach role_name in array array['anon','authenticated'] loop
     if has_table_privilege(role_name,'public.'||tab,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'Direct table access: % %',role_name,tab; end if;
   end loop;
  if exists(select 1 from pg_policies where schemaname='public' and tablename=tab
      and (roles && array['anon','authenticated','public']::name[])) then
    raise exception 'Client-role policy exists: %',tab;
  end if;
 end loop;
 for fn in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in ('api_create_project','api_update_project','api_set_project_member','api_close_project','api_assign_project_task','api_project_actor_can_create','api_project_is_lead','api_project_can_assign','api_assert_project_library','api_list_project_library','api_create_project_library_folder','api_mutate_project_library_folder','api_add_project_library_item','api_mutate_project_library_item','api_get_project_library_file','file_project_task_attachment','ensure_project_task_folder','guard_project_lead_role','guard_project_staff_role') loop
   if has_function_privilege('anon',fn,'EXECUTE') or has_function_privilege('authenticated',fn,'EXECUTE') or not has_function_privilege('service_role',fn,'EXECUTE') then raise exception 'Bad RPC ACL: %',fn; end if;
 end loop;
end $$;
rollback;

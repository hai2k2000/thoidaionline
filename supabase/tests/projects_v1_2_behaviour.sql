-- Run with psql -X -v ON_ERROR_STOP=1 -f supabase/tests/projects_v1_2_behaviour.sql
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
  employee_role uuid; ctv_job uuid; f public.project_library_folders; child public.project_library_folders; item public.project_library_items; auto_item public.project_library_items; attachment uuid;
  fixture_suffix text := replace(gen_random_uuid()::text,'-','');
begin
  insert into public.departments(code,name) values('zz_projects_host_'||fixture_suffix,'Project host') returning id into host_id;
  insert into public.departments(code,name) values('zz_projects_other_'||fixture_suffix,'Other department') returning id into other_id;
  select id into employee_role from public.roles where code='nhan_vien';
  if employee_role is null then raise exception 'Fixture needs nhan_vien role'; end if;
  -- ctv is a fixture-only catalog value; production migrations do not seed it.
  insert into public.job_titles(code,name,display_order,active)
  values('ctv','Project CTV '||fixture_suffix,999,true)
  on conflict do nothing;
  select id into ctv_job from public.job_titles where code='ctv' and active;
  if ctv_job is null then raise exception 'Fixture needs ctv job title'; end if;
  insert into public.staff_users(full_name,username,password,role_id,department_id)
  values('Project admin','zz_projects_admin_'||fixture_suffix,'test-only',(select id from public.roles where code='admin'),host_id) returning id into creator;
  -- A plain employee in another department must be able to review project tasks.
  insert into public.staff_users(full_name,username,password,role_id,department_id)
  values('Project lead','zz_projects_lead_'||fixture_suffix,'test-only',employee_role,other_id) returning id into lead_id;
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
  -- Role code, not job title, is the CTV authorization boundary.
  update public.staff_users set role_id=(select id from public.roles where code='cong_tac_vien') where id=ctv_id;
  perform pg_temp.expect_state(format('select public.api_create_project(%L,''ZZ-DENIED'',''Denied'',null,%L)',member_id,host_id),'42501');
  perform public.api_set_user_permission_override(creator,member_id,'project.create','allow','all');
  if not public.api_project_actor_can_create(member_id) then raise exception 'User grant missing'; end if;
  p:=public.api_create_project(member_id,'ZZ-V12-'||fixture_suffix,'V1.2 test',null,host_id,'{}');
  if not exists(select 1 from public.project_members where project_id=p.id and user_id=member_id and role='lead') then raise exception 'Creator must automatically lead'; end if;
  if exists(select 1 from public.project_members where project_id=p.id and user_id=creator) then raise exception 'Admin must remain nonmember'; end if;
  perform public.api_set_user_permission_override(creator,member_id,'project.create','deny','all');
  if public.api_project_actor_can_create(member_id) then raise exception 'Deny override ignored'; end if;
  perform public.api_clear_user_permission_override(creator,member_id,'project.create');
  if public.api_project_actor_can_create(member_id) then raise exception 'Revocation ignored'; end if;
  perform pg_temp.expect_state(format('select public.api_set_user_permission_override(%L,%L,''project.create'',''allow'',''all'')',creator,ctv_id),'42501');
  if public.api_project_actor_can_create(ctv_id) then raise exception 'CTV create allowed'; end if;
  if exists(select 1 from jsonb_array_elements(public.api_list_user_approval_permissions(creator,ctv_id)) x where x->>'permissionCode'='project.create') then raise exception 'CTV catalog exposed'; end if;
  perform public.api_set_project_member(creator,p.id,lead_id,'member');
  perform public.api_set_project_member(creator,p.id,ctv_id,'member');
  perform pg_temp.expect_state(format('select public.api_transfer_project_lead(%L,%L,%L,''member'')',outsider,p.id,lead_id),'42501');
  perform pg_temp.expect_state(format('select public.api_transfer_project_lead(%L,%L,%L,''member'')',member_id,p.id,ctv_id),'22023');
  perform pg_temp.expect_state(format('select public.api_transfer_project_lead(%L,%L,%L,''member'')',member_id,p.id,inactive_id),'22023');
  perform public.api_transfer_project_lead(member_id,p.id,lead_id,'deputy');
  if not exists(select 1 from public.project_members where project_id=p.id and user_id=member_id and role='deputy') then raise exception 'Own role was not changed'; end if;
  if not exists(select 1 from public.project_members where project_id=p.id and user_id=lead_id and role='lead') then raise exception 'New lead missing'; end if;
  perform pg_temp.expect_state(format('select public.api_transfer_project_lead(%L,%L,%L,''member'')',member_id,p.id,lead_id),'42501');
  perform public.api_transfer_project_lead(creator,p.id,member_id,'member');
  if exists(select 1 from public.project_members where project_id=p.id and user_id=creator) then raise exception 'Admin gained membership'; end if;
  if not exists(select 1 from public.audit_logs where entity_id=p.id and action='transfer_lead') then raise exception 'Transfer audit missing'; end if;
  perform public.api_update_project(creator,p.id,p.code,'Admin changed name',null,host_id);
  perform public.api_set_project_member(creator,p.id,second_lead,'deputy');
  t:=public.api_assign_project_task(member_id,p.id,'Cross-department review','Requirements',ctv_id,lead_id,current_date,'17:00');
  if t.reviewer_id<>lead_id or t.department_id<>host_id then raise exception 'Cross-department reviewer missing'; end if;
  -- Direct writes exercise the trigger independently of RPC reviewer validation.
  perform pg_temp.expect_state(format('update public.tasks set reviewer_id=%L where id=%L',second_lead,t.id),'42501');
  perform pg_temp.expect_state(format('update public.tasks set reviewer_id=%L where id=%L',inactive_id,t.id),'42501');
  perform pg_temp.expect_state(format('update public.tasks set reviewer_id=null where id=%L',t.id),'42501');
  perform pg_temp.expect_state(format('update public.tasks set project_id=null,reviewer_id=%L where id=%L',lead_id,t.id),'42501');
  perform pg_temp.expect_state(format('update public.tasks set self_claimable=true,assignment_mode=''multi_user'' where id=%L',t.id),'22023');
  update public.tasks set status='in_progress' where id=t.id;
  t:=public.api_submit_assigned_task_completion(ctv_id,t.id);
  perform pg_temp.expect_state(format('select public.api_review_task_completion(%L,%L,''reject'',''Revise'')',second_lead,t.id),'42501');
  perform public.api_review_assigned_task_completion(lead_id,t.id,'approve');
  if not exists(select 1 from public.tasks where id=t.id and status='done') then raise exception 'Cross-department lead scoring/review failed'; end if;
  -- Approval-required project rows must use the same project authorization.
  update public.tasks set approval_required=true,status='waiting' where id=t.id;
  perform pg_temp.expect_state(format('select public.api_approve_task_claim(%L,%L,''approve'')',second_lead,t.id),'42501');
  t:=public.api_approve_task_claim(lead_id,t.id,'approve');
  if t.status<>'in_progress' then raise exception 'Project assignment approval failed'; end if;
  update public.tasks set status='in_progress' where id=t.id;
  t:=public.api_submit_assigned_task_completion(ctv_id,t.id);
  perform pg_temp.expect_state(format('select public.api_review_assigned_task_completion(%L,%L,''approve'')',second_lead,t.id),'42501');
  perform public.api_review_assigned_task_completion(lead_id,t.id,'approve');
  if not exists(select 1 from public.tasks where id=t.id and status='done') then raise exception 'Project approval-required completion failed'; end if;
  t:=public.api_assign_project_task(creator,p.id,'Admin assigned','Requirements',ctv_id,creator,current_date,'17:00');
  if t.reviewer_id<>creator then raise exception 'Admin self reviewer rejected'; end if;
  perform public.api_assert_task_action(creator,t.id,'review');
  update public.tasks set status='in_progress' where id=t.id;
  t:=public.api_submit_assigned_task_completion(ctv_id,t.id);
  perform pg_temp.expect_state(format('select public.api_review_assigned_task_completion(%L,%L,''return'','' '')',lead_id,t.id),'22023');
  t:=public.api_review_task_completion(lead_id,t.id,'reject','Revise project work');
  if t.status<>'in_progress' then raise exception 'Lead rejection failed'; end if;
  if not exists(select 1 from public.task_comments where task_id=t.id and content='Revise project work') then raise exception 'Rejection comment missing'; end if;
  t:=public.api_submit_assigned_task_completion(ctv_id,t.id);
  if t.status<>'pending_review' then raise exception 'Resubmission failed'; end if;
  perform pg_temp.expect_state(format('select public.api_score_task_completion(%L,%L,''[]''::jsonb,60,20,20)',creator,t.id),'22023');
  t:=public.api_review_task_completion(creator,t.id,'approve');
  if t.status<>'done' or t.progress_percent<>100 then raise exception 'Score-free admin approval failed'; end if;
  if exists(select 1 from public.task_completion_scores s join public.tasks task on task.id=s.task_id where task.project_id=p.id) then raise exception 'Project score leaked'; end if;
  -- The original non-project trigger still requires a fresh score.
  update public.tasks set project_id=null,reviewer_id=null,approval_required=false,status='in_progress' where id=t.id;
  t:=public.api_submit_assigned_task_completion(ctv_id,t.id);
  perform pg_temp.expect_state(format('select public.api_review_assigned_task_completion(%L,%L,''approve'')',creator,t.id),'22023');
  perform public.api_score_task_completion(creator,t.id,'[]'::jsonb,60,20,20);
  if not exists(select 1 from public.tasks where id=t.id and status='done') then raise exception 'Non-project score approval failed'; end if;
  perform public.api_assert_project_library(creator,p.id,true);
  f:=public.api_create_project_library_folder(creator,p.id,'Admin folder',null);
  item:=public.api_add_project_library_item(member_id,p.id,f.id,'link','Test',null,'https://example.com');
  perform public.api_mutate_project_library_item(creator,p.id,item.id,'delete');
  perform public.api_close_project(creator,p.id);
end $$;
rollback;

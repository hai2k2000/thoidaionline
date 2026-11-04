-- Disposable restored schema only; fixtures and assertions roll back.
begin;
create function pg_temp.expect_state(p_sql text,p_state text) returns void language plpgsql as $$
begin
 begin execute p_sql; exception when others then if sqlstate=p_state then return; end if; raise; end;
 raise exception 'Expected SQLSTATE %',p_state;
end $$;
do $$
declare
 dept uuid; admin_id uuid; lead_id uuid; normal_reviewer uuid; member_id uuid; collaborator_id uuid; watcher_id uuid; outsider_id uuid;
 p public.projects; t public.tasks; pt public.tasks; assigned timestamptz;
 new_dept uuid; empty_dept uuid; new_manager uuid; new_owner uuid; no_manager_owner uuid;
 before_task jsonb; before_participants jsonb; before_audits bigint; participant_role text;
 suffix text:=replace(gen_random_uuid()::text,'-','');
begin
 insert into public.departments(code,name) values('zz_edit_'||suffix,'Edit fixture') returning id into dept;
 insert into public.staff_users(full_name,username,password,role_id,department_id) values('Admin','zz_edit_admin_'||suffix,'test-only',(select id from public.roles where code='admin'),dept) returning id into admin_id;
 insert into public.staff_users(full_name,username,password,role_id,department_id) values('Lead','zz_edit_lead_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),dept) returning id into lead_id;
 insert into public.staff_users(full_name,username,password,role_id,department_id) values('Member','zz_edit_member_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),dept) returning id into member_id;
 insert into public.staff_users(full_name,username,password,role_id,department_id) values('Collaborator','zz_edit_ctv_'||suffix,'test-only',(select id from public.roles where code='cong_tac_vien'),dept) returning id into collaborator_id;
 insert into public.staff_users(full_name,username,password,role_id,department_id) values('Watcher','zz_edit_watcher_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),dept) returning id into watcher_id;
 insert into public.staff_users(full_name,username,password,role_id,department_id) values('Outsider','zz_edit_other_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),dept) returning id into outsider_id;
 insert into public.staff_users(full_name,username,password,role_id,department_id) values('Department manager','zz_edit_mgr_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),dept) returning id into normal_reviewer;
 update public.departments set manager_id=normal_reviewer where id=dept;
 insert into public.tasks(title,description,department_id,assignee_id,owner_id,reviewer_id,created_by,task_type,status,start_date,due_date)
 values('No deadline','Content',dept,member_id,member_id,normal_reviewer,admin_id,'assigned','in_progress',null,null) returning * into t;
 t:=public.api_admin_edit_task(admin_id,t.id,'Edited','Content',current_date,null,null,'normal','in_progress',null,'No deadline');
 if t.due_date is not null or t.due_time is not null then raise exception 'No deadline edit failed'; end if;
 perform pg_temp.expect_state(format('select public.api_admin_edit_task(%L,%L,%L,%L,current_date,null,time %L,%L,%L,null,%L)',admin_id,t.id,'Edited','Content','17:00','normal','in_progress','Bad time'),'22023');
 perform public.api_admin_edit_task(admin_id,t.id,'Edited','Content',current_date,current_date+1,null,'normal','in_progress',null,'Add date');
 perform public.api_admin_edit_task(admin_id,t.id,'Edited','Content',current_date,null,null,'normal','in_progress',null,'Remove date');
 if not exists(select 1 from public.task_deadline_history where task_id=t.id and old_due_date is not null and new_due_date is null) then raise exception 'Null history missing'; end if;
 insert into public.task_comments(task_id,user_id,content) values(t.id,member_id,'Preserve comment');
 insert into public.task_progress_reports(task_id,reported_by,reported_on,report_status,progress_text) values(t.id,member_id,current_date,'in_progress','Preserve report');
 perform public.api_admin_set_task_participants(admin_id,t.id,member_id,array[collaborator_id],array[watcher_id],normal_reviewer,'Normal participants');
 set constraints all immediate;
 if not exists(select 1 from public.task_assignees where task_id=t.id and user_id=normal_reviewer and assignment_role='watcher') then raise exception 'Manager watcher missing'; end if;
 select assigned_at into assigned from public.task_assignees where task_id=t.id and user_id=member_id;
 update public.task_assignees set status='in_progress' where task_id=t.id and user_id=member_id;
 perform public.api_admin_set_task_participants(admin_id,t.id,member_id,array[collaborator_id],array[watcher_id],normal_reviewer,'Repeat participants');
 if exists(select 1 from public.task_assignees where task_id=t.id and user_id=normal_reviewer) then raise exception 'Unchanged owner re-added removed manager'; end if;
 if not exists(select 1 from public.task_assignees where task_id=t.id and user_id=member_id and status='in_progress' and assigned_at=assigned) then raise exception 'Participant progress changed'; end if;
 if not exists(select 1 from public.task_comments where task_id=t.id) or not exists(select 1 from public.task_progress_reports where task_id=t.id) then raise exception 'Reports removed'; end if;
 insert into public.departments(code,name) values('zz_new_'||suffix,'New manager fixture') returning id into new_dept;
 insert into public.departments(code,name) values('zz_empty_'||suffix,'No manager fixture') returning id into empty_dept;
 insert into public.staff_users(full_name,username,password,role_id,department_id) values('New manager','zz_mgr_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),new_dept) returning id into new_manager;
 insert into public.staff_users(full_name,username,password,role_id,department_id) values('New owner','zz_owner_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),new_dept) returning id into new_owner;
 insert into public.staff_users(full_name,username,password,role_id,department_id) values('No manager owner','zz_no_mgr_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),empty_dept) returning id into no_manager_owner;
 -- Staff inserts synchronize ALL department managers from job titles. These
 -- title-less fixtures must restore their explicit managers after the last insert.
 update public.departments set manager_id=normal_reviewer where id=dept;
 update public.departments set manager_id=new_manager where id=new_dept;
 perform public.api_admin_set_task_participants(admin_id,t.id,new_owner,array[collaborator_id],array[watcher_id],normal_reviewer,'Change owner');
 if not exists(select 1 from public.task_assignees where task_id=t.id and user_id=new_manager and assignment_role='watcher') then raise exception 'New owner manager missing'; end if;
 -- A pre-existing watcher omitted on an owner change is re-added by the new insert.
 perform public.api_admin_set_task_participants(admin_id,t.id,member_id,array[collaborator_id],array[watcher_id,new_manager],normal_reviewer,'Restore owner');
 perform public.api_admin_set_task_participants(admin_id,t.id,new_owner,array[collaborator_id],array[watcher_id],normal_reviewer,'Re-add manager');
 if not exists(select 1 from public.task_assignees where task_id=t.id and user_id=new_manager and assignment_role='watcher') then raise exception 'New owner did not re-add removed manager'; end if;
 -- Removing the manager from the department must not invalidate an unchanged owner.
 update public.departments set manager_id=null where id=new_dept;
 perform public.api_admin_set_task_participants(admin_id,t.id,new_owner,array[collaborator_id],array[watcher_id],normal_reviewer,'Unchanged owner without manager');
 if exists(select 1 from public.task_assignees where task_id=t.id and user_id=new_manager) then raise exception 'Explicit watcher removal ignored'; end if;
 select to_jsonb(x) into before_task from public.tasks x where id=t.id;
 select jsonb_agg(to_jsonb(x) order by user_id) into before_participants from public.task_assignees x where task_id=t.id;
 select count(*) into before_audits from public.audit_logs where entity_id=t.id;
 perform pg_temp.expect_state(format('select public.api_admin_set_task_participants(%L,%L,%L,%L::uuid[],%L::uuid[],%L,%L)',admin_id,t.id,no_manager_owner,'{}','{}',normal_reviewer,'No manager'),'22023');
 if before_task is distinct from (select to_jsonb(x) from public.tasks x where id=t.id)
   or before_participants is distinct from (select jsonb_agg(to_jsonb(x) order by user_id) from public.task_assignees x where task_id=t.id)
   or before_audits<>(select count(*) from public.audit_logs where entity_id=t.id) then raise exception 'Failed owner change left partial changes'; end if;
 -- Each forbidden admin role must roll back earlier participant deletes/inserts.
 foreach participant_role in array array['assignee','collaborator','watcher'] loop
   begin
     perform public.api_admin_set_task_participants(
       admin_id,t.id,case when participant_role='assignee' then admin_id else member_id end,
       case when participant_role='collaborator' then array[admin_id] else array[collaborator_id] end,
       case when participant_role='watcher' then array[admin_id] else array[watcher_id] end,
       normal_reviewer,'Reject admin '||participant_role);
     raise exception 'Admin % was accepted',participant_role;
   exception when sqlstate '42501' then
     if sqlerrm <> 'Admin cannot be an assignment participant.' then raise; end if;
   end;
   if before_task is distinct from (select to_jsonb(x) from public.tasks x where id=t.id)
     or before_participants is distinct from (select jsonb_agg(to_jsonb(x) order by user_id) from public.task_assignees x where task_id=t.id)
     or before_audits<>(select count(*) from public.audit_logs where entity_id=t.id) then
     raise exception 'Rejected admin % left partial changes',participant_role;
   end if;
 end loop;
 -- Project leadership alone does not qualify a normal-task reviewer. The RPC has
 -- already edited participants when the reviewer trigger runs; all edits must roll back.
 begin
   perform public.api_admin_set_task_participants(admin_id,t.id,member_id,'{}','{}',lead_id,'Reject non-leadership reviewer');
   raise exception 'Non-leadership normal reviewer was accepted';
 exception when sqlstate '42501' then
   if sqlerrm <> 'Người duyệt phải là Trưởng hoặc Phó phòng.' then raise; end if;
 end;
 if before_task is distinct from (select to_jsonb(x) from public.tasks x where id=t.id)
   or before_participants is distinct from (select jsonb_agg(to_jsonb(x) order by user_id) from public.task_assignees x where task_id=t.id)
   or before_audits<>(select count(*) from public.audit_logs where entity_id=t.id) then
   raise exception 'Rejected normal reviewer left partial changes';
 end if;
 perform public.api_admin_set_task_participants(admin_id,t.id,member_id,array[collaborator_id],array[watcher_id],normal_reviewer,'Normal department reviewer');
 perform pg_temp.expect_state(format('select public.api_admin_set_task_participants(%L,%L,%L,%L::uuid[],%L::uuid[],%L,%L)',member_id,t.id,member_id,'{}','{}',normal_reviewer,'Forbidden'),'42501');
 perform pg_temp.expect_state(format('select public.api_admin_set_task_participants(%L,%L,%L,%L::uuid[],%L::uuid[],%L,%L)',admin_id,t.id,member_id,array[member_id],'{}',normal_reviewer,'Overlap'),'22023');
 p:=public.api_create_project(admin_id,'ZZ-EDIT-'||suffix,'Edit fixture',null,dept,array[lead_id]);
 perform public.api_set_project_member(admin_id,p.id,member_id,'member');
 perform public.api_set_project_member(admin_id,p.id,collaborator_id,'member');
 perform public.api_set_project_member(admin_id,p.id,watcher_id,'member');
 pt:=public.api_assign_project_task(lead_id,p.id,'Project task','Content',member_id,lead_id,null,null);
 perform public.api_admin_set_task_participants(admin_id,pt.id,collaborator_id,array[member_id],array[watcher_id],lead_id,'Project participants');
 perform pg_temp.expect_state(format('select public.api_admin_set_task_participants(%L,%L,%L,%L::uuid[],%L::uuid[],%L,%L)',admin_id,pt.id,outsider_id,'{}','{}',lead_id,'Non-member'),'22023');
 perform pg_temp.expect_state(format('select public.api_admin_set_task_participants(%L,%L,%L,%L::uuid[],%L::uuid[],%L,%L)',admin_id,pt.id,member_id,'{}','{}',member_id,'Not lead'),'22023');
 perform pg_temp.expect_state(format('select public.api_admin_set_task_participants(%L,%L,%L,%L::uuid[],%L::uuid[],null,%L)',admin_id,pt.id,member_id,'{}','{}','No reviewer'),'22023');
 perform public.api_admin_set_task_participants(admin_id,pt.id,member_id,'{}','{}',admin_id,'Admin reviewer');
 -- Satisfy the real completion-score trigger before testing participant edits on done tasks.
 update public.tasks set status='pending_review',completion_submitted_at=now() where id=t.id;
 insert into public.task_completion_scores(task_id,reviewer_id,requirement_score,collaboration_score,initiative_score)
 values(t.id,normal_reviewer,60,20,20);
 update public.tasks set status='done' where id=t.id;
 t:=public.api_admin_set_task_participants(admin_id,t.id,collaborator_id,'{}','{}',normal_reviewer,'Completed task');
 if t.status<>'done' then raise exception 'Status changed'; end if;
 update public.tasks set status='cancelled' where id=t.id;
 perform pg_temp.expect_state(format('select public.api_admin_set_task_participants(%L,%L,%L,%L::uuid[],%L::uuid[],%L,%L)',admin_id,t.id,member_id,'{}','{}',normal_reviewer,'Cancelled'),'42501');
 if not exists(select 1 from public.audit_logs where entity_id=t.id and action='admin_participants' and new_data->>'reason'='Normal participants') then raise exception 'Audit missing'; end if;
end $$;
rollback;

-- Disposable restored schema only. All fixtures and assertions roll back.
begin;
create function pg_temp.expect_state(p_sql text,p_state text) returns void language plpgsql as $$
begin
 begin execute p_sql; exception when others then if sqlstate=p_state then return; end if; raise; end;
 raise exception 'Expected SQLSTATE %',p_state;
end $$;
do $$
declare
 dept uuid; admin_id uuid; lead_id uuid; member_id uuid; deputy_id uuid; inactive_id uuid;
 p public.projects; other_p public.projects; t public.tasks; valid_task public.tasks; active_task public.tasks; foreign_task public.tasks;
 attachment_id uuid; result jsonb; plan_id uuid; item_id uuid; old_item jsonb;
 suffix text:=replace(gen_random_uuid()::text,'-','');
begin
 insert into public.departments(code,name) values('zz_delete_'||suffix,'Delete fixture') returning id into dept;
 insert into public.staff_users(full_name,username,password,role_id,department_id)
 values('Delete admin','zz_delete_admin_'||suffix,'test-only',(select id from public.roles where code='admin'),dept) returning id into admin_id;
 insert into public.staff_users(full_name,username,password,role_id,department_id)
 values('Delete lead','zz_delete_lead_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),dept) returning id into lead_id;
 insert into public.staff_users(full_name,username,password,role_id,department_id)
 values('Delete member','zz_delete_member_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),dept) returning id into member_id;
 insert into public.staff_users(full_name,username,password,role_id,department_id)
 values('Delete deputy','zz_delete_deputy_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),dept) returning id into deputy_id;
 insert into public.staff_users(full_name,username,password,role_id,department_id,active)
 values('Inactive admin','zz_delete_inactive_'||suffix,'test-only',(select id from public.roles where code='admin'),dept,false) returning id into inactive_id;
 p:=public.api_create_project(admin_id,'ZZ-DELETE-'||suffix,'Delete fixture',null,dept,array[lead_id]);
 other_p:=public.api_create_project(admin_id,'ZZ-OTHER-'||suffix,'Other fixture',null,dept,array[lead_id]);
 perform public.api_set_project_member(admin_id,p.id,member_id,'member');
 perform public.api_set_project_member(admin_id,p.id,deputy_id,'deputy');
 perform public.api_set_project_member(admin_id,other_p.id,member_id,'member');
 perform public.api_set_project_member(admin_id,p.id,admin_id,null,true);
 t:=public.api_assign_project_task(lead_id,p.id,'Cancelled fixture','Requirements',member_id,lead_id,current_date,'17:00');
 valid_task:=public.api_assign_project_task(lead_id,p.id,'Second cancelled','Requirements',member_id,lead_id,current_date,'17:00');
 active_task:=public.api_assign_project_task(lead_id,p.id,'Active fixture','Requirements',member_id,lead_id,current_date,'17:00');
 foreign_task:=public.api_assign_project_task(lead_id,other_p.id,'Other project fixture','Requirements',member_id,lead_id,current_date,'17:00');
 update public.tasks set status='cancelled',cancelled_at=now() where id in(t.id,valid_task.id,foreign_task.id);
 insert into public.task_comments(task_id,user_id,content) values(t.id,member_id,'Delete comment');
 insert into public.task_progress_reports(task_id,reported_by,reported_on,report_status,progress_text) values(t.id,member_id,current_date,'in_progress','Progress');
 insert into public.task_deadline_history(task_id,old_due_date,new_due_date,reason,changed_by) values(t.id,current_date,current_date+1,'Test',lead_id);
 insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id) values(t.id,'new','cancelled','Test',lead_id);
 insert into public.task_attachments(task_id,storage_path,file_name,mime_type,size_bytes,uploaded_by)
 values(t.id,'test-delete/'||suffix||'.pdf','fixture.pdf','application/pdf',1,member_id) returning id into attachment_id;
 -- A separate manual library entry sharing another task's path must keep its bytes.
 insert into public.task_attachments(task_id,storage_path,file_name,mime_type,size_bytes,uploaded_by)
 values(valid_task.id,'test-shared/'||suffix||'.pdf','shared.pdf','application/pdf',1,member_id);
 insert into public.project_library_items(project_id,kind,title,storage_path,file_name,mime_type,size_bytes,uploaded_by)
 values(p.id,'file','Keep shared file','test-shared/'||suffix||'.pdf','shared.pdf','application/pdf',1,member_id);
 -- Preserve the entire closed-plan snapshot, detaching only its task link.
 insert into public.department_plans(department_id,period_type,period_start,period_end,created_by)
 values(dept,'monthly',date_trunc('month',current_date)::date,(date_trunc('month',current_date)+interval '1 month - 1 day')::date,admin_id) returning id into plan_id;
 insert into public.department_plan_items(department_plan_id,department_id,title,assignee_id,assignment_state,linked_task_id,created_by)
 values(plan_id,dept,'Historical plan item',member_id,'assigned',t.id,admin_id) returning id into item_id;
 update public.department_plans set status='closed' where id=plan_id;
 select to_jsonb(i)-'linked_task_id' into old_item from public.department_plan_items i where id=item_id;
 perform pg_temp.expect_state(format('update public.department_plan_items set linked_task_id=null where id=%L',item_id),'23514');
 perform pg_temp.expect_state(format('select public.api_delete_cancelled_project_tasks(%L,%L,%L::uuid[])',lead_id,p.id,array[t.id,active_task.id]),'22023');
 if not exists(select 1 from public.tasks where id=t.id) or exists(select 1 from public.audit_logs where entity_id=t.id and action='hard_delete') then raise exception 'Mixed batch was not atomic'; end if;
 perform pg_temp.expect_state(format('select public.api_delete_cancelled_project_tasks(%L,%L,%L::uuid[])',lead_id,p.id,array[t.id,foreign_task.id]),'22023');
 perform pg_temp.expect_state(format('select public.api_delete_cancelled_project_tasks(%L,%L,%L::uuid[])',member_id,p.id,array[t.id]),'42501');
 perform pg_temp.expect_state(format('select public.api_delete_cancelled_project_tasks(%L,%L,%L::uuid[])',deputy_id,p.id,array[t.id]),'42501');
 perform pg_temp.expect_state(format('select public.api_delete_cancelled_project_tasks(%L,%L,%L::uuid[])',inactive_id,p.id,array[t.id]),'42501');
 result:=public.api_delete_cancelled_project_tasks(lead_id,p.id,array[t.id,t.id]);
 if (result->>'deleted')::int<>1 or not (result->'storage_paths' ? ('test-delete/'||suffix||'.pdf')) then raise exception 'Deletion count/path incorrect'; end if;
 if exists(select 1 from public.tasks where id=t.id) or exists(select 1 from public.task_comments where task_id=t.id) or exists(select 1 from public.task_attachments where task_id=t.id) or exists(select 1 from public.task_status_events where task_id=t.id) or exists(select 1 from public.task_progress_reports where task_id=t.id) or exists(select 1 from public.task_deadline_history where task_id=t.id) or exists(select 1 from public.project_library_items where source_task_id=t.id) then raise exception 'Task children remain'; end if;
 if (select count(*) from public.audit_logs where entity_id=t.id and action='hard_delete' and module='project' and old_data->>'title'='Cancelled fixture' and old_data->>'comments'='1' and old_data->>'attachments'='1')<>1 then raise exception 'Audit snapshot missing'; end if;
 if not exists(select 1 from public.department_plan_items i where id=item_id and linked_task_id is null and to_jsonb(i)-'linked_task_id'=old_item) then raise exception 'Historical plan changed'; end if;
 update public.projects set status='closed' where id=p.id;
 perform pg_temp.expect_state(format('select public.api_delete_cancelled_project_tasks(%L,%L,%L::uuid[])',lead_id,p.id,array[valid_task.id]),'55000');
 result:=public.api_delete_cancelled_project_tasks(admin_id,p.id,array[valid_task.id]);
 if (result->>'deleted')::int<>1 then raise exception 'Admin closed-project delete failed'; end if;
 if result->'storage_paths' ? ('test-shared/'||suffix||'.pdf') then raise exception 'Shared library bytes scheduled for removal'; end if;
 if not exists(select 1 from public.project_library_items where title='Keep shared file' and project_id=p.id) then raise exception 'Manual library item removed'; end if;
 if coalesce(current_setting('thoidai.project_task_delete',true),'')<>'' then raise exception 'Delete context leaked'; end if;
 if not exists(select 1 from public.tasks where id=active_task.id) or not exists(select 1 from public.tasks where id=foreign_task.id) then raise exception 'Unrelated tasks removed'; end if;
end $$;
rollback;

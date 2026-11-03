-- Run only against the intended target with a verified backup. Refuse loss of manual library data.
begin;
lock table public.project_library_folders,public.project_library_items,public.project_members in access exclusive mode;
do $$ begin
 if exists(select 1 from public.project_library_items where source='manual') or exists(select 1 from public.project_library_folders where system_key is null) then raise exception 'Back up and resolve manual library content before reverting'; end if;
end $$;
drop trigger if exists file_project_task_attachment on public.task_attachments;
drop trigger if exists create_project_task_folder on public.projects;
drop trigger if exists guard_project_staff_role on public.staff_users;
drop function if exists public.guard_project_staff_role();
drop trigger if exists guard_project_lead_role on public.project_members;
drop function if exists public.file_project_task_attachment();
drop function if exists public.api_get_project_library_file(uuid,uuid,uuid);
drop function if exists public.api_mutate_project_library_item(uuid,uuid,uuid,text,text,uuid);
drop function if exists public.api_add_project_library_item(uuid,uuid,uuid,text,text,text,text,text,text,text,bigint);
drop function if exists public.api_mutate_project_library_folder(uuid,uuid,uuid,text,text,uuid);
drop function if exists public.api_create_project_library_folder(uuid,uuid,text,uuid);
drop function if exists public.api_list_project_library(uuid,uuid,uuid);
drop function if exists public.create_project_task_folder();
drop function if exists public.ensure_project_task_folder(uuid,uuid);
drop function if exists public.api_assert_project_library(uuid,uuid,boolean);
drop function if exists public.guard_project_lead_role();
drop function if exists public.api_project_can_assign(uuid,uuid);
drop table public.project_library_items;
drop table public.project_library_folders;
update public.project_members set role='member' where role='deputy';
alter table public.project_members drop constraint project_members_role_check;
alter table public.project_members add constraint project_members_role_check check(role in ('lead','member'));
create or replace function public.api_set_project_member(p_actor_id uuid,p_project_id uuid,p_user_id uuid,p_role text,p_remove boolean default false) returns public.project_members
language plpgsql security definer set search_path=public,pg_temp as $function$
declare v public.project_members;
begin
 perform 1 from public.projects where id=p_project_id for update;
 if not found then raise exception 'Project not found.' using errcode='P0002'; end if;
 if not public.api_project_is_lead(p_actor_id,p_project_id) then raise exception 'Project membership forbidden.' using errcode='42501'; end if;
 if (p_remove or p_role is distinct from 'lead') then
   if exists(select 1 from public.project_members where project_id=p_project_id and user_id=p_user_id and role='lead') and (select count(*) from public.project_members where project_id=p_project_id and role='lead') <= 1 then raise exception 'Cannot remove the last project lead.' using errcode='23514'; end if;
 end if;
 if p_remove then
   delete from public.project_members where project_id=p_project_id and user_id=p_user_id;
   insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor_id,'project','project_members',p_project_id,'remove',jsonb_build_object('user_id',p_user_id)); return null;
 end if;
 if p_role is null or p_role not in ('lead','member') or not exists(select 1 from public.staff_users where id=p_user_id and active) then raise exception 'Invalid project member.' using errcode='22023'; end if;
 insert into public.project_members(project_id,user_id,role,added_by) values(p_project_id,p_user_id,p_role,p_actor_id) on conflict(project_id,user_id) do update set role=excluded.role,added_by=excluded.added_by returning * into v;
 insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor_id,'project','project_members',p_project_id,'set_member',to_jsonb(v)); return v;
end $function$;
create or replace function public.api_assign_project_task(p_actor_id uuid,p_project_id uuid,p_title text,p_description text,p_assignee_id uuid,p_reviewer_id uuid,p_due_date date,p_due_time time,p_evaluation_criteria text default null,p_collaborator_ids uuid[] default '{}'::uuid[],p_watcher_ids uuid[] default '{}'::uuid[],p_priority text default 'normal',p_attachment_url text default null) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp as $function$
declare v public.tasks; x uuid; v_host uuid; v_status text;
begin
 select status,host_department_id into v_status,v_host from public.projects where id=p_project_id for update;
 if not found or v_status<>'active' then raise exception 'Project is closed or missing.' using errcode='42501'; end if;
 if not public.api_project_is_lead(p_actor_id,p_project_id) then raise exception 'Only project leads may assign.' using errcode='42501'; end if;
 p_reviewer_id := coalesce(p_reviewer_id,p_actor_id);
 if nullif(btrim(p_title),'') is null or nullif(btrim(p_description),'') is null or length(p_title)>500 or length(p_description)>10000 or length(p_evaluation_criteria)>10000 or length(p_attachment_url)>2048 or p_due_date is null or p_due_time is null or p_priority is null or p_priority not in ('low','normal','high','urgent') then raise exception 'Invalid assignment input.' using errcode='22023'; end if;
 if not exists(select 1 from public.project_members m join public.staff_users u on u.id=m.user_id where m.project_id=p_project_id and m.user_id=p_assignee_id and u.active) then raise exception 'Assignee must be an active project member.' using errcode='22023'; end if;
 if not public.api_project_is_lead(p_reviewer_id,p_project_id) then raise exception 'Reviewer must be a project lead.' using errcode='22023'; end if;
 if exists(select 1 from unnest(coalesce(p_collaborator_ids,'{}') || coalesce(p_watcher_ids,'{}')) candidate(id) where not exists(select 1 from public.project_members m join public.staff_users u on u.id=m.user_id where m.project_id=p_project_id and m.user_id=candidate.id and u.active)) then raise exception 'All project participants must be active members.' using errcode='22023'; end if;
 insert into public.tasks(title,description,project_id,department_id,assignee_id,owner_id,reviewer_id,created_by,assignment_mode,due_date,due_time,status,progress_percent,plan_period,self_claimable,task_type,priority,attachment_url,evaluation_criteria,start_date) values(btrim(p_title),btrim(p_description),p_project_id,v_host,p_assignee_id,p_assignee_id,p_reviewer_id,p_actor_id,case when cardinality(coalesce(p_collaborator_ids,'{}'))>0 then 'multi_user' else 'individual' end,p_due_date,p_due_time,'new',0,'ad_hoc',false,'assigned',p_priority,p_attachment_url,nullif(btrim(p_evaluation_criteria),''),timezone('Asia/Ho_Chi_Minh',now())::date) returning * into v;
 insert into public.task_assignees(task_id,user_id,assignment_role,status) values(v.id,p_assignee_id,'owner','todo');
 foreach x in array coalesce(p_collaborator_ids,'{}') loop if x<>p_assignee_id then insert into public.task_assignees(task_id,user_id,assignment_role,status) values(v.id,x,'assignee','todo') on conflict do nothing; end if; end loop;
 foreach x in array coalesce(p_watcher_ids,'{}') loop if x<>p_assignee_id and not (x=any(coalesce(p_collaborator_ids,'{}'))) then insert into public.task_assignees(task_id,user_id,assignment_role,status) values(v.id,x,'watcher','todo') on conflict do nothing; end if; end loop;
 insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor_id,'project','tasks',v.id,'assign',jsonb_build_object('project_id',p_project_id)); return v;
end $function$;
notify pgrst,'reload schema';
commit;

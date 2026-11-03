-- Projects V1.1: deputy assignment and private project library.
begin;
alter table public.project_members drop constraint if exists project_members_role_check;
alter table public.project_members add constraint project_members_role_check check(role in ('lead','deputy','member'));

create or replace function public.api_project_can_assign(p_actor uuid,p_project uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.project_members m join public.staff_users u on u.id=m.user_id join public.roles r on r.id=u.role_id where m.project_id=p_project and m.user_id=p_actor and m.role in ('lead','deputy') and u.active and r.code<>'cong_tac_vien');
$$;
create or replace function public.guard_project_lead_role() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.role in ('lead','deputy') and exists(select 1 from public.staff_users u join public.roles r on r.id=u.role_id where u.id=new.user_id and r.code='cong_tac_vien') then raise exception 'CTV cannot lead a project.' using errcode='22023'; end if;
 return new;
end $$;
drop trigger if exists guard_project_lead_role on public.project_members;
create trigger guard_project_lead_role before insert or update on public.project_members for each row execute function public.guard_project_lead_role();

-- A later staff-role change must not turn an existing project leader into a CTV.
create or replace function public.guard_project_staff_role() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.role_id is distinct from old.role_id and exists(select 1 from public.roles where id=new.role_id and code='cong_tac_vien') and exists(select 1 from public.project_members where user_id=new.id and role in ('lead','deputy')) then raise exception 'Remove project leadership before assigning CTV role.' using errcode='22023'; end if;
 return new;
end $$;
drop trigger if exists guard_project_staff_role on public.staff_users;
create trigger guard_project_staff_role before update of role_id on public.staff_users for each row execute function public.guard_project_staff_role();

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
 if p_role is null or p_role not in ('lead','deputy','member') or not exists(select 1 from public.staff_users where id=p_user_id and active) then raise exception 'Invalid project member.' using errcode='22023'; end if;
 insert into public.project_members(project_id,user_id,role,added_by) values(p_project_id,p_user_id,p_role,p_actor_id) on conflict(project_id,user_id) do update set role=excluded.role,added_by=excluded.added_by returning * into v;
 insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor_id,'project','project_members',p_project_id,'set_member',to_jsonb(v)); return v;
end $function$;

create or replace function public.api_assign_project_task(p_actor_id uuid,p_project_id uuid,p_title text,p_description text,p_assignee_id uuid,p_reviewer_id uuid,p_due_date date,p_due_time time,p_evaluation_criteria text default null,p_collaborator_ids uuid[] default '{}'::uuid[],p_watcher_ids uuid[] default '{}'::uuid[],p_priority text default 'normal',p_attachment_url text default null) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp as $function$
declare v public.tasks; x uuid; v_host uuid; v_status text;
begin
 select status,host_department_id into v_status,v_host from public.projects where id=p_project_id for update;
 if not found or v_status<>'active' then raise exception 'Project is closed or missing.' using errcode='42501'; end if;
 if not public.api_project_can_assign(p_actor_id,p_project_id) then raise exception 'Only project leads and deputies may assign.' using errcode='42501'; end if;
 p_reviewer_id := coalesce(p_reviewer_id,case when public.api_project_is_lead(p_actor_id,p_project_id) then p_actor_id else (select m.user_id from public.project_members m join public.staff_users u on u.id=m.user_id where m.project_id=p_project_id and m.role='lead' and u.active order by m.added_at,m.user_id limit 1) end);
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

create table if not exists public.project_library_folders (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id),
 parent_id uuid, name text not null check(length(btrim(name)) between 1 and 250),
 system_key text check(system_key is null or system_key='task_files'),
 created_by uuid not null references public.staff_users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(id,project_id), foreign key(parent_id,project_id) references public.project_library_folders(id,project_id)
);
create unique index if not exists project_library_folder_name_uq on public.project_library_folders(project_id,coalesce(parent_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(name)) where deleted_at is null;
create unique index if not exists project_library_system_uq on public.project_library_folders(project_id,system_key) where system_key is not null;
create table if not exists public.project_library_items (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id), folder_id uuid,
 kind text not null check(kind in ('file','link')), title text not null check(length(btrim(title)) between 1 and 500), description text check(length(description)<=10000),
 storage_path text, file_name text, mime_type text, size_bytes bigint, url text,
 source text not null default 'manual' check(source in ('manual','task_attachment','progress_report','completion')),
 source_task_id uuid references public.tasks(id), source_attachment_id uuid unique references public.task_attachments(id),
 uploaded_by uuid not null references public.staff_users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 foreign key(folder_id,project_id) references public.project_library_folders(id,project_id),
 check((kind='file' and nullif(storage_path,'') is not null and nullif(file_name,'') is not null and nullif(mime_type,'') is not null and size_bytes is not null and size_bytes>0 and url is null) or (kind='link' and url is not null and length(url)<=2048 and url ~ '^https://[^[:space:]/]+[^[:space:]]*$' and storage_path is null)),
 check((source='manual' and source_attachment_id is null and source_task_id is null) or (source<>'manual' and source_attachment_id is not null and source_task_id is not null))
);
create index if not exists project_library_items_folder_idx on public.project_library_items(project_id,folder_id,created_at desc) where deleted_at is null;
alter table public.project_library_folders enable row level security;
alter table public.project_library_items enable row level security;
revoke all on table public.project_library_folders,public.project_library_items from public,anon,authenticated;
grant all on table public.project_library_folders,public.project_library_items to service_role;

-- Serialize mutations per project so ancestor checks cannot race another move.
create or replace function public.api_assert_project_library(p_actor uuid,p_project uuid,p_write boolean default false) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_write then perform 1 from public.projects where id=p_project for update; end if;
 if not exists(select 1 from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor and u.active and
   (exists(select 1 from public.project_members m where m.project_id=p_project and m.user_id=u.id) or (not p_write and r.code in ('admin','tong_bien_tap'))))
 then raise exception 'Library forbidden' using errcode='42501'; end if;
end $$;
create or replace function public.ensure_project_task_folder(p_project uuid,p_actor uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v uuid;
begin
 perform 1 from public.projects where id=p_project for update;
 select id into v from public.project_library_folders where project_id=p_project and system_key='task_files';
 if v is null then insert into public.project_library_folders(project_id,name,system_key,created_by) values(p_project,'Tệp từ công việc','task_files',p_actor) returning id into v; end if;
 return v;
end $$;
create or replace function public.create_project_task_folder() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin perform public.ensure_project_task_folder(new.id,new.created_by); return new; end $$;
drop trigger if exists create_project_task_folder on public.projects;
create trigger create_project_task_folder after insert on public.projects for each row execute function public.create_project_task_folder();

create or replace function public.api_list_project_library(p_actor_id uuid,p_project_id uuid,p_folder_id uuid default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.api_assert_project_library(p_actor_id,p_project_id);
 if p_folder_id is not null and not exists(select 1 from public.project_library_folders where id=p_folder_id and project_id=p_project_id and deleted_at is null) then raise exception 'Folder not found' using errcode='P0002'; end if;
 insert into public.audit_logs(actor_id,module,entity_type,entity_id,action) values(p_actor_id,'project_library','projects',p_project_id,'list');
 return jsonb_build_object('folders',coalesce((select jsonb_agg(to_jsonb(f) order by lower(f.name)) from public.project_library_folders f where f.project_id=p_project_id and f.deleted_at is null),'[]'::jsonb),
 'items',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('uploaded_by_name',u.full_name,'task_title',t.title) order by i.created_at desc) from public.project_library_items i join public.staff_users u on u.id=i.uploaded_by left join public.tasks t on t.id=i.source_task_id where i.project_id=p_project_id and i.folder_id is not distinct from p_folder_id and i.deleted_at is null),'[]'::jsonb));
end $$;
create or replace function public.api_create_project_library_folder(p_actor_id uuid,p_project_id uuid,p_name text,p_parent_id uuid default null) returns public.project_library_folders
language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.project_library_folders;
begin
 perform public.api_assert_project_library(p_actor_id,p_project_id,true);
 if p_parent_id is not null and not exists(select 1 from public.project_library_folders where id=p_parent_id and project_id=p_project_id and deleted_at is null) then raise exception 'Invalid parent' using errcode='22023'; end if;
 insert into public.project_library_folders(project_id,parent_id,name,created_by) values(p_project_id,p_parent_id,btrim(p_name),p_actor_id) returning * into v;
 insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor_id,'project_library','folder',v.id,'create',to_jsonb(v)); return v;
end $$;
create or replace function public.api_mutate_project_library_folder(p_actor_id uuid,p_project_id uuid,p_folder_id uuid,p_action text,p_name text default null,p_parent_id uuid default null) returns public.project_library_folders
language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.project_library_folders; old_data jsonb;
begin
 perform public.api_assert_project_library(p_actor_id,p_project_id,true);
 select * into v from public.project_library_folders where id=p_folder_id and project_id=p_project_id and deleted_at is null for update;
 if not found then raise exception 'Folder not found' using errcode='P0002'; end if;
 if v.system_key is not null or not (v.created_by=p_actor_id or public.api_project_can_assign(p_actor_id,p_project_id)) then raise exception 'Folder forbidden' using errcode='42501'; end if;
 old_data:=to_jsonb(v);
 if p_action='rename' then update public.project_library_folders set name=btrim(p_name),updated_at=now() where id=v.id returning * into v;
 elsif p_action='move' then
   if p_parent_id is not null and not exists(select 1 from public.project_library_folders where id=p_parent_id and project_id=p_project_id and deleted_at is null) then raise exception 'Invalid parent' using errcode='22023'; end if;
   if exists(with recursive descendants as (select id from public.project_library_folders where id=p_folder_id union all select f.id from public.project_library_folders f join descendants d on f.parent_id=d.id) select 1 from descendants where id=p_parent_id) then raise exception 'Folder cycle' using errcode='22023'; end if;
   update public.project_library_folders set parent_id=p_parent_id,updated_at=now() where id=v.id returning * into v;
 elsif p_action='delete' then
   -- Require empty folders, preserving others' files and automatic attachments.
   if exists(select 1 from public.project_library_folders where parent_id=v.id and deleted_at is null) or exists(select 1 from public.project_library_items where folder_id=v.id and deleted_at is null) then raise exception 'Folder is not empty' using errcode='23514'; end if;
   update public.project_library_folders set deleted_at=now(),updated_at=now() where id=v.id returning * into v;
 else raise exception 'Invalid action' using errcode='22023'; end if;
 insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values(p_actor_id,'project_library','folder',v.id,p_action,old_data,to_jsonb(v)); return v;
end $$;
create or replace function public.api_add_project_library_item(p_actor_id uuid,p_project_id uuid,p_folder_id uuid,p_kind text,p_title text,p_description text default null,p_url text default null,p_storage_path text default null,p_file_name text default null,p_mime_type text default null,p_size_bytes bigint default null) returns public.project_library_items
language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.project_library_items;
begin
 perform public.api_assert_project_library(p_actor_id,p_project_id,true);
 if p_folder_id is not null and not exists(select 1 from public.project_library_folders where id=p_folder_id and project_id=p_project_id and deleted_at is null) then raise exception 'Invalid folder' using errcode='22023'; end if;
 if p_kind='file' and (p_storage_path is null or p_storage_path not like 'projects/'||p_project_id::text||'/'||p_actor_id::text||'/%' or p_size_bytes is null or p_size_bytes not between 1 and 10485760 or p_mime_type is null or p_mime_type not in ('application/pdf','image/png','image/jpeg','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) then raise exception 'Invalid file' using errcode='22023'; end if;
 insert into public.project_library_items(project_id,folder_id,kind,title,description,url,storage_path,file_name,mime_type,size_bytes,uploaded_by) values(p_project_id,p_folder_id,p_kind,btrim(p_title),p_description,p_url,p_storage_path,p_file_name,p_mime_type,p_size_bytes,p_actor_id) returning * into v;
 insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor_id,'project_library','item',v.id,'create',to_jsonb(v)); return v;
end $$;
create or replace function public.api_mutate_project_library_item(p_actor_id uuid,p_project_id uuid,p_item_id uuid,p_action text,p_title text default null,p_folder_id uuid default null) returns public.project_library_items
language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.project_library_items; old_data jsonb; manager boolean;
begin
 perform public.api_assert_project_library(p_actor_id,p_project_id,true);
 select * into v from public.project_library_items where id=p_item_id and project_id=p_project_id and deleted_at is null for update;
 if not found then raise exception 'Item not found' using errcode='P0002'; end if;
 manager:=public.api_project_can_assign(p_actor_id,p_project_id);
 if v.source<>'manual' then
   if p_action='delete' or not manager then raise exception 'Automatic item protected' using errcode='42501'; end if;
 elsif not (manager or v.uploaded_by=p_actor_id) then raise exception 'Item forbidden' using errcode='42501'; end if;
 old_data:=to_jsonb(v);
 if p_action='rename' then update public.project_library_items set title=btrim(p_title),updated_at=now() where id=v.id returning * into v;
 elsif p_action='move' then
   if p_folder_id is not null and not exists(select 1 from public.project_library_folders where id=p_folder_id and project_id=p_project_id and deleted_at is null) then raise exception 'Invalid folder' using errcode='22023'; end if;
   update public.project_library_items set folder_id=p_folder_id,updated_at=now() where id=v.id returning * into v;
 elsif p_action='delete' then update public.project_library_items set deleted_at=now(),updated_at=now() where id=v.id returning * into v;
 else raise exception 'Invalid action' using errcode='22023'; end if;
 insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values(p_actor_id,'project_library','item',v.id,p_action,old_data,to_jsonb(v)); return v;
end $$;
create or replace function public.api_get_project_library_file(p_actor_id uuid,p_project_id uuid,p_item_id uuid) returns public.project_library_items
language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.project_library_items;
begin
 perform public.api_assert_project_library(p_actor_id,p_project_id);
 select * into v from public.project_library_items where id=p_item_id and project_id=p_project_id and kind='file' and deleted_at is null;
 if not found then raise exception 'Item not found' using errcode='P0002'; end if;
 insert into public.audit_logs(actor_id,module,entity_type,entity_id,action) values(p_actor_id,'project_library','item',v.id,'download'); return v;
end $$;
-- All three task workflows use task_attachments, sharing the original storage object.
create or replace function public.file_project_task_attachment() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare p uuid; f uuid;
begin
 select project_id into p from public.tasks where id=new.task_id;
 if p is null then return new; end if;
 f:=public.ensure_project_task_folder(p,new.uploaded_by);
 insert into public.project_library_items(project_id,folder_id,kind,title,storage_path,file_name,mime_type,size_bytes,source,source_task_id,source_attachment_id,uploaded_by,created_at)
 values(p,f,'file',new.file_name,new.storage_path,new.file_name,new.mime_type,new.size_bytes,'task_attachment',new.task_id,new.id,new.uploaded_by,new.created_at) on conflict(source_attachment_id) do nothing;
 insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(new.uploaded_by,'project_library','task_attachments',new.id,'auto_file',jsonb_build_object('project_id',p));
 return new;
end $$;
drop trigger if exists file_project_task_attachment on public.task_attachments;
create trigger file_project_task_attachment after insert on public.task_attachments for each row execute function public.file_project_task_attachment();
select public.ensure_project_task_folder(id,created_by) from public.projects;
insert into public.project_library_items(project_id,folder_id,kind,title,storage_path,file_name,mime_type,size_bytes,source,source_task_id,source_attachment_id,uploaded_by,created_at)
select t.project_id,f.id,'file',a.file_name,a.storage_path,a.file_name,a.mime_type,a.size_bytes,'task_attachment',a.task_id,a.id,a.uploaded_by,a.created_at
from public.task_attachments a join public.tasks t on t.id=a.task_id join public.project_library_folders f on f.project_id=t.project_id and f.system_key='task_files' on conflict(source_attachment_id) do nothing;
do $$ declare f regprocedure; begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in ('api_project_can_assign','guard_project_staff_role','guard_project_lead_role','api_assert_project_library','ensure_project_task_folder','create_project_task_folder','api_list_project_library','api_create_project_library_folder','api_mutate_project_library_folder','api_add_project_library_item','api_mutate_project_library_item','api_get_project_library_file','file_project_task_attachment') loop
 execute format('revoke all on function %s from public,anon,authenticated',f);
 execute format('grant execute on function %s to service_role',f);
 execute format('alter function %s owner to postgres',f);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;

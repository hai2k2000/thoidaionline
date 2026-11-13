-- Extend only the existing MIME allowlists. Existing ACLs, size and authorization checks are preserved.
begin;
set local lock_timeout = '5s';
create or replace function public.api_add_task_attachment(
  p_actor_id uuid,p_task_id uuid,p_storage_path text,p_file_name text,
  p_mime_type text,p_size_bytes bigint
)
returns public.task_attachments
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_task public.tasks; v_attachment public.task_attachments; v_allowed boolean;
begin
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
  if v_task.status='cancelled' then raise exception 'Cancelled task upload forbidden.' using errcode='42501'; end if;
  select (
    r.code='admin' or v_task.created_by=p_actor_id or v_task.owner_id=p_actor_id
    or v_task.assignee_id=p_actor_id
    or exists(select 1 from public.task_assignees a where a.task_id=p_task_id and a.user_id=p_actor_id and a.assignment_role<>'watcher')
    or (coalesce(rp.can_assign_task,false) and u.department_id is not null and u.department_id=v_task.department_id)
  ) into v_allowed
  from public.staff_users u join public.roles r on r.id=u.role_id
  left join public.role_permissions rp on rp.role_id=r.id
  where u.id=p_actor_id and u.active=true;
  if not coalesce(v_allowed,false) then raise exception 'Attachment upload forbidden.' using errcode='42501'; end if;
  if p_storage_path not like p_task_id::text || '/%'
     or nullif(btrim(p_file_name),'') is null or length(p_file_name)>500
     or p_mime_type not in ('application/pdf','image/png','image/jpeg','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/msword','application/vnd.ms-excel')
     or p_size_bytes<=0 or p_size_bytes>10485760 then
    raise exception 'Invalid private attachment metadata.' using errcode='22023';
  end if;
  insert into public.task_attachments(task_id,storage_path,file_name,mime_type,size_bytes,uploaded_by)
  values(p_task_id,p_storage_path,btrim(p_file_name),p_mime_type,p_size_bytes,p_actor_id)
  returning * into v_attachment;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor_id,'task','task_attachments',v_attachment.id,'create',jsonb_build_object('task_id',p_task_id,'mime_type',p_mime_type,'size_bytes',p_size_bytes));
  return v_attachment;
end
$function$;

create or replace function public.api_add_project_library_item(p_actor_id uuid,p_project_id uuid,p_folder_id uuid,p_kind text,p_title text,p_description text default null,p_url text default null,p_storage_path text default null,p_file_name text default null,p_mime_type text default null,p_size_bytes bigint default null) returns public.project_library_items
language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.project_library_items;
begin
 perform public.api_assert_project_library(p_actor_id,p_project_id,true);
 if p_folder_id is not null and not exists(select 1 from public.project_library_folders where id=p_folder_id and project_id=p_project_id and deleted_at is null) then raise exception 'Invalid folder' using errcode='22023'; end if;
 if p_kind='file' and (p_storage_path is null or p_storage_path not like 'projects/'||p_project_id::text||'/'||p_actor_id::text||'/%' or p_size_bytes is null or p_size_bytes not between 1 and 10485760 or p_mime_type is null or p_mime_type not in ('application/pdf','image/png','image/jpeg','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/msword','application/vnd.ms-excel')) then raise exception 'Invalid file' using errcode='22023'; end if;
 insert into public.project_library_items(project_id,folder_id,kind,title,description,url,storage_path,file_name,mime_type,size_bytes,uploaded_by) values(p_project_id,p_folder_id,p_kind,btrim(p_title),p_description,p_url,p_storage_path,p_file_name,p_mime_type,p_size_bytes,p_actor_id) returning * into v;
 insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor_id,'project_library','item',v.id,'create',to_jsonb(v)); return v;
end $$;
notify pgrst,'reload schema';
commit;

begin;
alter table public.task_attachments add column if not exists deleted_at timestamptz;
create or replace function public.api_admin_delete_task_attachment(p_actor_id uuid,p_task_id uuid,p_attachment_id uuid,p_reason text)
returns public.task_attachments language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_attachment public.task_attachments; v_after public.task_attachments;
begin
 if not exists(select 1 from staff_users u join roles r on r.id=u.role_id where u.id=p_actor_id and u.active and r.active and r.code='admin') then raise exception 'Admin attachment delete forbidden.' using errcode='42501'; end if;
 if nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then raise exception 'Delete reason required.' using errcode='22023'; end if;
 perform 1 from tasks where id=p_task_id for update;
 if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
 select * into v_attachment from task_attachments where id=p_attachment_id and task_id=p_task_id for update;
 if not found then raise exception 'Attachment not found.' using errcode='P0002'; end if;
 -- A retry returns the same storage key without duplicating the audit.
 if v_attachment.deleted_at is not null then return v_attachment; end if;
 update project_library_items set deleted_at=now(),updated_at=now() where source_attachment_id=p_attachment_id and deleted_at is null;
 update task_attachments set deleted_at=now() where id=p_attachment_id returning * into v_after;
 insert into audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values(p_actor_id,'task','task_attachments',p_attachment_id,'admin_delete',to_jsonb(v_attachment),jsonb_build_object('task_id',p_task_id,'reason',btrim(p_reason)));
 return v_after;
end $function$;
revoke all on function public.api_admin_delete_task_attachment(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.api_admin_delete_task_attachment(uuid,uuid,uuid,text) to service_role;
alter function public.api_admin_delete_task_attachment(uuid,uuid,uuid,text) owner to postgres;

-- Preserve legacy criteria verbatim while retaining existing lifecycle guards.
do $patch$
declare definition text;
begin
 select pg_get_functiondef('public.api_admin_edit_task_unchecked(uuid,uuid,text,text,date,date,time,text,text,text,text)'::regprocedure) into definition;
 execute replace(definition, $old$evaluation_criteria=nullif(btrim(p_evaluation_criteria),'')$old$, 'evaluation_criteria=p_evaluation_criteria');
end $patch$;
-- Personnel evaluation is the other attachment reader outside taskRepository.
do $patch$
declare definition text;
begin
 select pg_get_functiondef('public.api_get_personnel_evaluation_detail(uuid,uuid,date,date)'::regprocedure) into definition;
 execute replace(definition, 'from public.task_attachments a where a.task_id=task.id)', 'from public.task_attachments a where a.task_id=task.id and a.deleted_at is null)');
end $patch$;

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
     or p_mime_type not in ('application/pdf','image/png','image/jpeg','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
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
notify pgrst,'reload schema'; commit;


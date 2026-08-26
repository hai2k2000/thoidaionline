-- Phase 5: canonical task detail workflow and private attachment metadata.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'task-private','task-private',false,10485760,
  array['application/pdf','image/png','image/jpeg','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types,
  updated_at=now();
-- Invariant: task-private public=false.

create or replace function public.api_submit_task_progress_report(
  p_actor_id uuid,p_task_id uuid,p_reported_on date,p_report_status text,
  p_progress_text text,p_blockers text default null
)
returns public.task_progress_reports
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_before public.tasks;
  v_after_status text;
  v_report public.task_progress_reports;
begin
  perform public.api_assert_task_action(p_actor_id,p_task_id,'report');
  select * into v_before from public.tasks where id=p_task_id for update;
  if v_before.task_type is null or v_before.status in ('pending_review','done','cancelled') then
    raise exception 'Task cannot accept progress reports.' using errcode='22023';
  end if;
  if p_reported_on is null
     or p_report_status not in ('in_progress','blocked','waiting','nearly_done')
     or nullif(btrim(p_progress_text),'') is null or length(p_progress_text)>10000
     or (p_report_status='blocked' and nullif(btrim(p_blockers),'') is null)
     or length(coalesce(p_blockers,''))>10000 then
    raise exception 'Invalid structured progress report.' using errcode='22023';
  end if;
  insert into public.task_progress_reports(task_id,reported_by,reported_on,report_status,progress_text,blockers)
  values(p_task_id,p_actor_id,p_reported_on,p_report_status,btrim(p_progress_text),nullif(btrim(p_blockers),''))
  returning * into v_report;
  v_after_status := case when p_report_status in ('blocked','waiting') then p_report_status else 'in_progress' end;
  if v_before.status is distinct from v_after_status then
    update public.tasks set status=v_after_status,updated_at=now() where id=p_task_id;
    insert into public.task_status_events(task_id,from_status,to_status,actor_id)
    values(p_task_id,v_before.status,v_after_status,p_actor_id);
  else
    update public.tasks set updated_at=now() where id=p_task_id;
  end if;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor_id,'task','task_progress_reports',v_report.id,'submit',
    jsonb_build_object('task_id',p_task_id,'report_status',p_report_status,'reported_on',p_reported_on));
  return v_report;
end
$function$;

create or replace function public.api_submit_assigned_task_completion(
  p_actor_id uuid,p_task_id uuid
)
returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_before public.tasks; v_after public.tasks; v_now timestamptz:=now();
begin
  perform public.api_assert_task_action(p_actor_id,p_task_id,'report');
  select * into v_before from public.tasks where id=p_task_id for update;
  if v_before.task_type<>'assigned' or v_before.status not in ('new','in_progress','blocked','waiting','rejected') then
    raise exception 'Invalid assigned completion transition.' using errcode='22023';
  end if;
  update public.tasks set status='pending_review',completion_submitted_at=v_now,updated_at=v_now
  where id=p_task_id returning * into v_after;
  insert into public.task_status_events(task_id,from_status,to_status,actor_id)
  values(p_task_id,v_before.status,'pending_review',p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor_id,'task','tasks',p_task_id,'submit',jsonb_build_object('status',v_before.status),jsonb_build_object('status','pending_review','completion_submitted_at',v_now));
  return v_after;
end
$function$;

create or replace function public.api_review_assigned_task_completion(
  p_actor_id uuid,p_task_id uuid,p_decision text,p_reason text default null
)
returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_before public.tasks; v_after public.tasks; v_status text; v_now timestamptz:=now();
begin
  perform public.api_assert_task_action(p_actor_id,p_task_id,'review');
  select * into v_before from public.tasks where id=p_task_id for update;
  if v_before.task_type<>'assigned' or v_before.status<>'pending_review'
     or p_decision not in ('approve','return')
     or (p_decision='return' and nullif(btrim(p_reason),'') is null)
     or length(coalesce(p_reason,''))>2000 then
    raise exception 'Invalid assigned review.' using errcode='22023';
  end if;
  v_status:=case when p_decision='approve' then 'done' else 'rejected' end;
  update public.tasks set status=v_status,
    completed_at=case when p_decision='approve' then v_now else null end,
    updated_at=v_now where id=p_task_id returning * into v_after;
  insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id)
  values(p_task_id,'pending_review',v_status,nullif(btrim(p_reason),''),p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor_id,'task','tasks',p_task_id,case when p_decision='approve' then 'approve' else 'return' end,
    jsonb_build_object('status','pending_review'),jsonb_build_object('status',v_status,'reason',nullif(btrim(p_reason),'')));
  return v_after;
end
$function$;

create or replace function public.api_cancel_assigned_task(
  p_actor_id uuid,p_task_id uuid,p_reason text
)
returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_before public.tasks; v_after public.tasks; v_now timestamptz:=now();
begin
  perform public.api_assert_task_action(p_actor_id,p_task_id,'update');
  select * into v_before from public.tasks where id=p_task_id for update;
  if v_before.task_type<>'assigned' or v_before.status in ('done','cancelled')
     or nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then
    raise exception 'Invalid assigned cancellation.' using errcode='22023';
  end if;
  update public.tasks set status='cancelled',cancelled_at=v_now,cancelled_by=p_actor_id,
    cancel_reason=btrim(p_reason),updated_at=v_now where id=p_task_id returning * into v_after;
  insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id)
  values(p_task_id,v_before.status,'cancelled',btrim(p_reason),p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor_id,'task','tasks',p_task_id,'cancel',jsonb_build_object('status',v_before.status),jsonb_build_object('status','cancelled','reason',btrim(p_reason)));
  return v_after;
end
$function$;

create or replace function public.api_change_assigned_task_deadline(
  p_actor_id uuid,p_task_id uuid,p_new_due_date date,p_reason text
)
returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_before public.tasks; v_after public.tasks;
begin
  perform public.api_assert_task_action(p_actor_id,p_task_id,'update');
  select * into v_before from public.tasks where id=p_task_id for update;
  if v_before.task_type<>'assigned' or v_before.status in ('done','cancelled')
     or p_new_due_date is null or p_new_due_date<v_before.start_date
     or p_new_due_date is not distinct from v_before.due_date
     or nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then
    raise exception 'Invalid assigned deadline change.' using errcode='22023';
  end if;
  update public.tasks set due_date=p_new_due_date,updated_at=now() where id=p_task_id returning * into v_after;
  insert into public.task_deadline_history(task_id,old_due_date,new_due_date,reason,changed_by)
  values(p_task_id,v_before.due_date,p_new_due_date,btrim(p_reason),p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor_id,'task','tasks',p_task_id,'deadline_change',jsonb_build_object('due_date',v_before.due_date),jsonb_build_object('due_date',p_new_due_date,'reason',btrim(p_reason)));
  return v_after;
end
$function$;

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
     or p_size_bytes<=0 or p_size_bytes>2147483648 then
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

revoke all on function public.api_submit_task_progress_report(uuid,uuid,date,text,text,text) from public,anon,authenticated;
revoke all on function public.api_submit_assigned_task_completion(uuid,uuid) from public,anon,authenticated;
revoke all on function public.api_review_assigned_task_completion(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.api_cancel_assigned_task(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.api_change_assigned_task_deadline(uuid,uuid,date,text) from public,anon,authenticated;
revoke all on function public.api_add_task_attachment(uuid,uuid,text,text,text,bigint) from public,anon,authenticated;

grant execute on function public.api_submit_task_progress_report(uuid,uuid,date,text,text,text) to service_role;
grant execute on function public.api_submit_assigned_task_completion(uuid,uuid) to service_role;
grant execute on function public.api_review_assigned_task_completion(uuid,uuid,text,text) to service_role;
grant execute on function public.api_cancel_assigned_task(uuid,uuid,text) to service_role;
grant execute on function public.api_change_assigned_task_deadline(uuid,uuid,date,text) to service_role;
grant execute on function public.api_add_task_attachment(uuid,uuid,text,text,text,bigint) to service_role;

alter function public.api_submit_task_progress_report(uuid,uuid,date,text,text,text) owner to postgres;
alter function public.api_submit_assigned_task_completion(uuid,uuid) owner to postgres;
alter function public.api_review_assigned_task_completion(uuid,uuid,text,text) owner to postgres;
alter function public.api_cancel_assigned_task(uuid,uuid,text) owner to postgres;
alter function public.api_change_assigned_task_deadline(uuid,uuid,date,text) owner to postgres;
alter function public.api_add_task_attachment(uuid,uuid,text,text,text,bigint) owner to postgres;
begin;

-- Keep task assignment authority separate from edit/cancel authority.
-- Only Admin may mutate another user's task or a terminal task.
create or replace function public.api_update_task(
  p_actor_id uuid,
  p_task_id uuid,
  p_status text default null,
  p_due_date date default null,
  p_update_due_date boolean default false,
  p_priority text default null,
  p_update_priority boolean default false
)
returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_before public.tasks;
  v_after public.tasks;
  v_role_code text;
begin
  select * into v_before from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
  select r.code into v_role_code
    from public.staff_users u join public.roles r on r.id=u.role_id
   where u.id=p_actor_id and u.active=true;
  if v_role_code is null then raise exception 'Invalid task actor.' using errcode='42501'; end if;
  if v_role_code <> 'admin'
     and (v_before.created_by is distinct from p_actor_id
       or v_before.status in ('done','cancelled')) then
    raise exception 'Only the task creator may edit an unapproved task.' using errcode='42501';
  end if;
  if p_status is not null and p_status not in ('new','in_progress') then
    raise exception 'Use report/review for completion transitions.' using errcode='22023';
  end if;
  if p_update_priority and p_priority not in ('low','normal','high','urgent') then
    raise exception 'Invalid task priority.' using errcode='22023';
  end if;
  if p_status is null and not p_update_due_date and not p_update_priority then
    raise exception 'No update supplied.' using errcode='22023';
  end if;
  update public.tasks set
    status=coalesce(p_status,status),
    due_date=case when p_update_due_date then p_due_date else due_date end,
    priority=case when p_update_priority then p_priority else priority end,
    updated_at=now()
  where id=p_task_id returning * into v_after;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor_id,'task','tasks',p_task_id,'update',
    jsonb_build_object('status',v_before.status,'due_date',v_before.due_date,'priority',v_before.priority),
    jsonb_build_object('status',v_after.status,'due_date',v_after.due_date,'priority',v_after.priority));
  return v_after;
end
$function$;

create or replace function public.api_cancel_assigned_task(
  p_actor_id uuid,
  p_task_id uuid,
  p_reason text
)
returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_before public.tasks;
  v_after public.tasks;
  v_role_code text;
  v_now timestamptz:=now();
begin
  select * into v_before from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
  select r.code into v_role_code
    from public.staff_users u join public.roles r on r.id=u.role_id
   where u.id=p_actor_id and u.active=true;
  if v_role_code is null then raise exception 'Invalid task actor.' using errcode='42501'; end if;
  if v_before.task_type<>'assigned'
     or v_before.status='cancelled'
     or (v_role_code<>'admin' and (v_before.created_by is distinct from p_actor_id or v_before.status='done'))
     or nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then
    raise exception 'Invalid assigned cancellation.' using errcode='22023';
  end if;
  update public.tasks set status='cancelled',cancelled_at=v_now,cancelled_by=p_actor_id,
    cancel_reason=btrim(p_reason),updated_at=v_now
  where id=p_task_id returning * into v_after;
  insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id)
  values(p_task_id,v_before.status,'cancelled',btrim(p_reason),p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor_id,'task','tasks',p_task_id,'cancel',
    jsonb_build_object('status',v_before.status),
    jsonb_build_object('status','cancelled','reason',btrim(p_reason)));
  return v_after;
end
$function$;

create or replace function public.api_change_assigned_task_deadline(
  p_actor_id uuid,
  p_task_id uuid,
  p_new_due_date date,
  p_reason text
)
returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_before public.tasks;
  v_after public.tasks;
  v_role_code text;
begin
  select * into v_before from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
  select r.code into v_role_code
    from public.staff_users u join public.roles r on r.id=u.role_id
   where u.id=p_actor_id and u.active=true;
  if v_role_code is null then raise exception 'Invalid task actor.' using errcode='42501'; end if;
  if v_before.task_type<>'assigned'
     or (v_role_code<>'admin' and (v_before.created_by is distinct from p_actor_id or v_before.status in ('done','cancelled')))
     or p_new_due_date is null
     or p_new_due_date<v_before.start_date
     or p_new_due_date is not distinct from v_before.due_date
     or nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then
    raise exception 'Invalid assigned deadline change.' using errcode='22023';
  end if;
  update public.tasks set due_date=p_new_due_date,updated_at=now()
  where id=p_task_id returning * into v_after;
  insert into public.task_deadline_history(task_id,old_due_date,new_due_date,reason,changed_by)
  values(p_task_id,v_before.due_date,p_new_due_date,btrim(p_reason),p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor_id,'task','tasks',p_task_id,'deadline_change',
    jsonb_build_object('due_date',v_before.due_date),
    jsonb_build_object('due_date',p_new_due_date,'reason',btrim(p_reason)));
  return v_after;
end
$function$;

revoke all on function public.api_update_task(uuid,uuid,text,date,boolean,text,boolean) from public,anon,authenticated;
revoke all on function public.api_cancel_assigned_task(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.api_change_assigned_task_deadline(uuid,uuid,date,text) from public,anon,authenticated;
grant execute on function public.api_update_task(uuid,uuid,text,date,boolean,text,boolean) to service_role;
grant execute on function public.api_cancel_assigned_task(uuid,uuid,text) to service_role;
grant execute on function public.api_change_assigned_task_deadline(uuid,uuid,date,text) to service_role;
alter function public.api_update_task(uuid,uuid,text,date,boolean,text,boolean) owner to postgres;
alter function public.api_cancel_assigned_task(uuid,uuid,text) owner to postgres;
alter function public.api_change_assigned_task_deadline(uuid,uuid,date,text) owner to postgres;
notify pgrst,'reload schema';
commit;

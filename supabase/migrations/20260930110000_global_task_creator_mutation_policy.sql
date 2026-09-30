begin;

-- Shared DB guard: creator may mutate only before assignment approval; Admin may
-- mutate approved records; cancelled records are immutable for everyone.
create or replace function public.api_assert_task_creator_mutation(
  p_actor_id uuid,
  p_task_id uuid,
  p_action text
) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_task public.tasks;
  v_role_code text;
  v_approved boolean;
begin
  if p_action not in ('edit','cancel') then
    raise exception 'mutation policy unavailable' using errcode='42501';
  end if;
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
  if v_task.created_by is null then
    raise exception 'Task creator identity unavailable.' using errcode='42501';
  end if;
  if v_task.status not in ('new','waiting','in_progress','blocked','pending_review','rejected','done','cancelled') then
    raise exception 'Task lifecycle state unavailable.' using errcode='42501';
  end if;
  select lower(r.code) into v_role_code
    from public.staff_users u join public.roles r on r.id=u.role_id
   where u.id=p_actor_id and u.active=true and r.active=true;
  if v_role_code is null then raise exception 'Invalid task actor.' using errcode='42501'; end if;
  if v_task.status='cancelled' then
    raise exception 'Cancelled task cannot be mutated.' using errcode='42501';
  end if;
  -- Task final approval is represented only by the terminal done status.
  -- Assignment approval metadata/events do not close creator mutation rights.
  v_approved := v_task.status='done';
  if v_role_code<>'admin' and (v_task.created_by is distinct from p_actor_id or v_approved) then
    raise exception 'Only the creator may mutate an unapproved task.' using errcode='42501';
  end if;
  return v_task;
end
$function$;

create or replace function public.api_update_task(
  p_actor_id uuid,p_task_id uuid,p_status text default null,
  p_due_date date default null,p_update_due_date boolean default false,
  p_priority text default null,p_update_priority boolean default false
) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_before public.tasks; v_after public.tasks;
begin
  v_before := public.api_assert_task_creator_mutation(p_actor_id,p_task_id,'edit');
  if p_status is not null and p_status not in ('new','in_progress') then raise exception 'Use report/review for completion transitions.' using errcode='22023'; end if;
  if p_update_priority and p_priority not in ('low','normal','high','urgent') then raise exception 'Invalid task priority.' using errcode='22023'; end if;
  if p_status is null and not p_update_due_date and not p_update_priority then raise exception 'No update supplied.' using errcode='22023'; end if;
  update public.tasks set status=coalesce(p_status,status),due_date=case when p_update_due_date then p_due_date else due_date end,priority=case when p_update_priority then p_priority else priority end,updated_at=now() where id=p_task_id returning * into v_after;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor_id,'task','tasks',p_task_id,'update',jsonb_build_object('status',v_before.status,'due_date',v_before.due_date,'priority',v_before.priority),jsonb_build_object('status',v_after.status,'due_date',v_after.due_date,'priority',v_after.priority));
  return v_after;
end
$function$;

create or replace function public.api_edit_personal_task(
  p_actor_id uuid,p_task_id uuid,p_title text,p_description text,p_start_date date,p_evaluation_criteria text default null
) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_before public.tasks; v_after public.tasks;
begin
  v_before := public.api_assert_task_creator_mutation(p_actor_id,p_task_id,'edit');
  if v_before.task_type is distinct from 'personal' then raise exception 'Personal task action forbidden.' using errcode='42501'; end if;
  if nullif(btrim(p_title),'') is null or length(p_title)>500 or nullif(btrim(p_description),'') is null or length(p_description)>10000 or p_start_date is null or (v_before.due_date is not null and p_start_date>v_before.due_date) or length(coalesce(p_evaluation_criteria,''))>10000 then raise exception 'Invalid personal task input.' using errcode='22023'; end if;
  update public.tasks set title=btrim(p_title),description=btrim(p_description),start_date=p_start_date,evaluation_criteria=nullif(btrim(p_evaluation_criteria),''),updated_at=now() where id=p_task_id returning * into v_after;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values(p_actor_id,'task','tasks',p_task_id,'update',jsonb_build_object('start_date',v_before.start_date),jsonb_build_object('start_date',v_after.start_date));
  return v_after;
end
$function$;

create or replace function public.api_cancel_personal_task(p_actor_id uuid,p_task_id uuid,p_reason text)
returns public.tasks language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_before public.tasks; v_after public.tasks;
begin
  v_before := public.api_assert_task_creator_mutation(p_actor_id,p_task_id,'cancel');
  if v_before.task_type is distinct from 'personal' or nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then raise exception 'Cancellation reason is required.' using errcode='22023'; end if;
  update public.tasks set status='cancelled',cancelled_at=now(),cancelled_by=p_actor_id,cancel_reason=btrim(p_reason),updated_at=now() where id=p_task_id returning * into v_after;
  insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id) values(p_task_id,v_before.status,'cancelled',btrim(p_reason),p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values(p_actor_id,'task','tasks',p_task_id,'cancel',jsonb_build_object('status',v_before.status),jsonb_build_object('status','cancelled','reason',btrim(p_reason)));
  return v_after;
end
$function$;

create or replace function public.api_cancel_assigned_task(p_actor_id uuid,p_task_id uuid,p_reason text)
returns public.tasks language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_before public.tasks; v_after public.tasks;
begin
  v_before := public.api_assert_task_creator_mutation(p_actor_id,p_task_id,'cancel');
  if v_before.task_type is distinct from 'assigned' or nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then raise exception 'Invalid assigned cancellation.' using errcode='22023'; end if;
  update public.tasks set status='cancelled',cancelled_at=now(),cancelled_by=p_actor_id,cancel_reason=btrim(p_reason),updated_at=now() where id=p_task_id returning * into v_after;
  insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id) values(p_task_id,v_before.status,'cancelled',btrim(p_reason),p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values(p_actor_id,'task','tasks',p_task_id,'cancel',jsonb_build_object('status',v_before.status),jsonb_build_object('status','cancelled','reason',btrim(p_reason)));
  return v_after;
end
$function$;

create or replace function public.api_change_personal_task_deadline(p_actor_id uuid,p_task_id uuid,p_new_due_date date,p_reason text)
returns public.tasks language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_before public.tasks; v_after public.tasks;
begin
  v_before := public.api_assert_task_creator_mutation(p_actor_id,p_task_id,'edit');
  if v_before.task_type is distinct from 'personal' or p_new_due_date is null or p_new_due_date<v_before.start_date or p_new_due_date is not distinct from v_before.due_date or nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then raise exception 'Invalid deadline change.' using errcode='22023'; end if;
  update public.tasks set due_date=p_new_due_date,updated_at=now() where id=p_task_id returning * into v_after;
  insert into public.task_deadline_history(task_id,old_due_date,new_due_date,reason,changed_by) values(p_task_id,v_before.due_date,p_new_due_date,btrim(p_reason),p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values(p_actor_id,'task','tasks',p_task_id,'deadline_change',jsonb_build_object('due_date',v_before.due_date),jsonb_build_object('due_date',p_new_due_date,'reason',btrim(p_reason)));
  return v_after;
end
$function$;

create or replace function public.api_change_assigned_task_deadline(p_actor_id uuid,p_task_id uuid,p_new_due_date date,p_reason text)
returns public.tasks language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_before public.tasks; v_after public.tasks;
begin
  v_before := public.api_assert_task_creator_mutation(p_actor_id,p_task_id,'edit');
  if v_before.task_type is distinct from 'assigned' or p_new_due_date is null or p_new_due_date<v_before.start_date or p_new_due_date is not distinct from v_before.due_date or nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then raise exception 'Invalid assigned deadline change.' using errcode='22023'; end if;
  update public.tasks set due_date=p_new_due_date,updated_at=now() where id=p_task_id returning * into v_after;
  insert into public.task_deadline_history(task_id,old_due_date,new_due_date,reason,changed_by) values(p_task_id,v_before.due_date,p_new_due_date,btrim(p_reason),p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values(p_actor_id,'task','tasks',p_task_id,'deadline_change',jsonb_build_object('due_date',v_before.due_date),jsonb_build_object('due_date',p_new_due_date,'reason',btrim(p_reason)));
  return v_after;
end
$function$;

revoke all on function public.api_assert_task_creator_mutation(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.api_assert_task_creator_mutation(uuid,uuid,text) to service_role;
revoke all on function public.api_update_task(uuid,uuid,text,date,boolean) from public,anon,authenticated;
revoke all on function public.api_update_task(uuid,uuid,text,date,boolean,text,boolean) from public,anon,authenticated;
revoke all on function public.api_edit_personal_task(uuid,uuid,text,text,date,text) from public,anon,authenticated;
revoke all on function public.api_cancel_personal_task(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.api_cancel_assigned_task(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.api_change_personal_task_deadline(uuid,uuid,date,text) from public,anon,authenticated;
revoke all on function public.api_change_assigned_task_deadline(uuid,uuid,date,text) from public,anon,authenticated;
grant execute on function public.api_update_task(uuid,uuid,text,date,boolean) to service_role;
grant execute on function public.api_update_task(uuid,uuid,text,date,boolean,text,boolean) to service_role;
grant execute on function public.api_edit_personal_task(uuid,uuid,text,text,date,text) to service_role;
grant execute on function public.api_cancel_personal_task(uuid,uuid,text) to service_role;
grant execute on function public.api_cancel_assigned_task(uuid,uuid,text) to service_role;
grant execute on function public.api_change_personal_task_deadline(uuid,uuid,date,text) to service_role;
grant execute on function public.api_change_assigned_task_deadline(uuid,uuid,date,text) to service_role;
notify pgrst,'reload schema';
commit;

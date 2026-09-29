begin;

-- Admin may edit or cancel any task. Other roles may mutate only before
-- completion approval (done) and never after cancellation.
create or replace function public.api_assert_personal_task_owner(
  p_actor_id uuid,
  p_task_id uuid,
  p_allow_terminal boolean default false
) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_task public.tasks;
  v_role_code text;
begin
  select r.code into v_role_code
  from public.staff_users u join public.roles r on r.id=u.role_id
  where u.id=p_actor_id and u.active=true;
  if v_role_code is null then raise exception 'Invalid task actor.' using errcode='42501'; end if;
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
  if v_task.task_type is distinct from 'personal'
     or (v_task.owner_id is distinct from p_actor_id and v_role_code<>'admin') then
    raise exception 'Personal task action forbidden.' using errcode='42501';
  end if;
  if not p_allow_terminal and v_role_code<>'admin' and v_task.status in ('done','cancelled') then
    raise exception 'Approved or cancelled task is immutable.' using errcode='22023';
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
declare v_before public.tasks; v_after public.tasks; v_role_code text;
begin
  select * into v_before from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
  perform public.api_assert_task_action(p_actor_id,p_task_id,'update');
  select r.code into v_role_code from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor_id and u.active=true;
  if v_role_code<>'admin' and v_before.status in ('done','cancelled') then
    raise exception 'Approved or cancelled task cannot be edited.' using errcode='42501';
  end if;
  if p_status is not null and p_status not in ('new','in_progress') then raise exception 'Use report/review for completion transitions.' using errcode='22023'; end if;
  if p_update_priority and p_priority not in ('low','normal','high','urgent') then raise exception 'Invalid task priority.' using errcode='22023'; end if;
  if p_status is null and not p_update_due_date and not p_update_priority then raise exception 'No update supplied.' using errcode='22023'; end if;
  update public.tasks set status=coalesce(p_status,status),due_date=case when p_update_due_date then p_due_date else due_date end,priority=case when p_update_priority then p_priority else priority end,updated_at=now() where id=p_task_id returning * into v_after;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values(p_actor_id,'task','tasks',p_task_id,'update',jsonb_build_object('status',v_before.status,'due_date',v_before.due_date,'priority',v_before.priority),jsonb_build_object('status',v_after.status,'due_date',v_after.due_date,'priority',v_after.priority));
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
  v_before := public.api_assert_personal_task_owner(p_actor_id,p_task_id,true);
  if v_before.status in ('done','cancelled') and not exists(select 1 from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor_id and r.code='admin') then raise exception 'Approved or cancelled task cannot be edited.' using errcode='42501'; end if;
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
  v_before := public.api_assert_personal_task_owner(p_actor_id,p_task_id,true);
  if v_before.status='cancelled' or (v_before.status='done' and not exists(select 1 from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor_id and r.code='admin')) then raise exception 'Approved or cancelled task cannot be cancelled.' using errcode='42501'; end if;
  if nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then raise exception 'Cancellation reason is required.' using errcode='22023'; end if;
  update public.tasks set status='cancelled',cancelled_at=now(),cancelled_by=p_actor_id,cancel_reason=btrim(p_reason),updated_at=now() where id=p_task_id returning * into v_after;
  insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id) values(p_task_id,v_before.status,'cancelled',btrim(p_reason),p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values(p_actor_id,'task','tasks',p_task_id,'cancel',jsonb_build_object('status',v_before.status),jsonb_build_object('status','cancelled','reason',btrim(p_reason)));
  return v_after;
end
$function$;

create or replace function public.api_cancel_assigned_task(p_actor_id uuid,p_task_id uuid,p_reason text)
returns public.tasks language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_before public.tasks; v_after public.tasks; v_role_code text;
begin
  select * into v_before from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
  perform public.api_assert_task_action(p_actor_id,p_task_id,'update');
  select r.code into v_role_code from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor_id and u.active=true;
  if v_before.task_type<>'assigned' or v_before.status='cancelled' or (v_before.status='done' and v_role_code<>'admin') or nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then raise exception 'Invalid assigned cancellation.' using errcode='22023'; end if;
  update public.tasks set status='cancelled',cancelled_at=now(),cancelled_by=p_actor_id,cancel_reason=btrim(p_reason),updated_at=now() where id=p_task_id returning * into v_after;
  insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id) values(p_task_id,v_before.status,'cancelled',btrim(p_reason),p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values(p_actor_id,'task','tasks',p_task_id,'cancel',jsonb_build_object('status',v_before.status),jsonb_build_object('status','cancelled','reason',btrim(p_reason)));
  return v_after;
end
$function$;

revoke all on function public.api_assert_personal_task_owner(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.api_assert_personal_task_owner(uuid,uuid,boolean) to service_role;
alter function public.api_assert_personal_task_owner(uuid,uuid,boolean) owner to postgres;
notify pgrst,'reload schema';
commit;

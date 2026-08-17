-- Phase 4: canonical personal-task mutations and transactional history.

create or replace function public.api_assert_personal_task_owner(
  p_actor_id uuid,
  p_task_id uuid,
  p_allow_terminal boolean default false
)
returns public.tasks
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_task public.tasks;
  v_role_code text;
begin
  select r.code into v_role_code
  from public.staff_users u
  join public.roles r on r.id=u.role_id
  where u.id=p_actor_id and u.active=true;
  if v_role_code is null then
    raise exception 'Invalid task actor.' using errcode='42501';
  end if;

  select * into v_task
  from public.tasks
  where id=p_task_id
  for update;
  if not found then
    raise exception 'Task not found.' using errcode='P0002';
  end if;
  if v_task.task_type is distinct from 'personal'
     or (v_task.owner_id is distinct from p_actor_id and v_role_code<>'admin') then
    raise exception 'Personal task action forbidden.' using errcode='42501';
  end if;
  if not p_allow_terminal and v_task.status in ('done','cancelled') then
    raise exception 'Terminal personal task is immutable.' using errcode='22023';
  end if;
  return v_task;
end
$function$;

create or replace function public.api_create_personal_task(
  p_actor_id uuid,
  p_title text,
  p_description text,
  p_start_date date,
  p_due_date date,
  p_evaluation_criteria text default null
)
returns public.tasks
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_task public.tasks;
  v_department_id uuid;
begin
  select department_id into v_department_id
  from public.staff_users
  where id=p_actor_id and active=true;
  if not found then
    raise exception 'Invalid task actor.' using errcode='42501';
  end if;
  if nullif(btrim(p_title),'') is null or length(p_title)>500
     or nullif(btrim(p_description),'') is null or length(p_description)>10000
     or p_start_date is null or p_due_date is null or p_start_date>p_due_date
     or length(coalesce(p_evaluation_criteria,''))>10000 then
    raise exception 'Invalid personal task input.' using errcode='22023';
  end if;

  insert into public.tasks(
    title,description,status,progress_percent,assignee_id,owner_id,
    assignment_mode,created_by,department_id,due_date,plan_period,
    self_claimable,task_type,start_date,evaluation_criteria
  ) values (
    btrim(p_title),btrim(p_description),'new',0,p_actor_id,p_actor_id,
    'individual',p_actor_id,v_department_id,p_due_date,'ad_hoc',
    false,'personal',p_start_date,nullif(btrim(p_evaluation_criteria),'')
  ) returning * into v_task;

  insert into public.task_assignees(task_id,user_id,assignment_role,status)
  values(v_task.id,p_actor_id,'owner','todo')
  on conflict(task_id,user_id) do update
    set assignment_role='owner',status='todo';

  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor_id,'task','tasks',v_task.id,'create',
    jsonb_build_object('task_type','personal','status','new'));
  return v_task;
end
$function$;

create or replace function public.api_edit_personal_task(
  p_actor_id uuid,
  p_task_id uuid,
  p_title text,
  p_description text,
  p_start_date date,
  p_evaluation_criteria text default null
)
returns public.tasks
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_before public.tasks;
  v_after public.tasks;
begin
  v_before := public.api_assert_personal_task_owner(p_actor_id,p_task_id,false);
  if nullif(btrim(p_title),'') is null or length(p_title)>500
     or nullif(btrim(p_description),'') is null or length(p_description)>10000
     or p_start_date is null or (v_before.due_date is not null and p_start_date>v_before.due_date)
     or length(coalesce(p_evaluation_criteria,''))>10000 then
    raise exception 'Invalid personal task input.' using errcode='22023';
  end if;
  update public.tasks
  set title=btrim(p_title),description=btrim(p_description),
      start_date=p_start_date,
      evaluation_criteria=nullif(btrim(p_evaluation_criteria),''),
      updated_at=now()
  where id=p_task_id
  returning * into v_after;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor_id,'task','tasks',p_task_id,'update',
    jsonb_build_object('start_date',v_before.start_date),
    jsonb_build_object('start_date',v_after.start_date));
  return v_after;
end
$function$;

create or replace function public.api_change_personal_task_deadline(
  p_actor_id uuid,
  p_task_id uuid,
  p_new_due_date date,
  p_reason text
)
returns public.tasks
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_before public.tasks;
  v_after public.tasks;
begin
  v_before := public.api_assert_personal_task_owner(p_actor_id,p_task_id,false);
  if p_new_due_date is null or p_new_due_date<v_before.start_date
     or p_new_due_date is not distinct from v_before.due_date
     or nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then
    raise exception 'Invalid deadline change.' using errcode='22023';
  end if;
  update public.tasks set due_date=p_new_due_date,updated_at=now()
  where id=p_task_id returning * into v_after;
  insert into public.task_deadline_history(
    task_id,old_due_date,new_due_date,reason,changed_by
  ) values(p_task_id,v_before.due_date,p_new_due_date,btrim(p_reason),p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor_id,'task','tasks',p_task_id,'deadline_change',
    jsonb_build_object('due_date',v_before.due_date),
    jsonb_build_object('due_date',p_new_due_date,'reason',btrim(p_reason)));
  return v_after;
end
$function$;

create or replace function public.api_cancel_personal_task(
  p_actor_id uuid,
  p_task_id uuid,
  p_reason text
)
returns public.tasks
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_before public.tasks;
  v_after public.tasks;
begin
  v_before := public.api_assert_personal_task_owner(p_actor_id,p_task_id,false);
  if nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then
    raise exception 'Cancellation reason is required.' using errcode='22023';
  end if;
  update public.tasks
  set status='cancelled',cancelled_at=now(),cancelled_by=p_actor_id,
      cancel_reason=btrim(p_reason),updated_at=now()
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

create or replace function public.api_complete_personal_task(
  p_actor_id uuid,
  p_task_id uuid
)
returns public.tasks
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_before public.tasks;
  v_after public.tasks;
  v_completed_at timestamptz := now();
begin
  v_before := public.api_assert_personal_task_owner(p_actor_id,p_task_id,false);
  if v_before.status not in ('new','in_progress','blocked','waiting','rejected') then
    raise exception 'Invalid personal completion transition.' using errcode='22023';
  end if;
  update public.tasks
  set status='done',completion_submitted_at=v_completed_at,
      completed_at=v_completed_at,updated_at=v_completed_at
  where id=p_task_id returning * into v_after;
  insert into public.task_status_events(task_id,from_status,to_status,actor_id)
  values(p_task_id,v_before.status,'done',p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor_id,'task','tasks',p_task_id,'complete',
    jsonb_build_object('status',v_before.status),
    jsonb_build_object('status','done','completed_at',v_completed_at));
  return v_after;
end
$function$;

revoke all on function public.api_assert_personal_task_owner(uuid,uuid,boolean)
  from public,anon,authenticated;
revoke all on function public.api_create_personal_task(uuid,text,text,date,date,text)
  from public,anon,authenticated;
revoke all on function public.api_edit_personal_task(uuid,uuid,text,text,date,text)
  from public,anon,authenticated;
revoke all on function public.api_change_personal_task_deadline(uuid,uuid,date,text)
  from public,anon,authenticated;
revoke all on function public.api_cancel_personal_task(uuid,uuid,text)
  from public,anon,authenticated;
revoke all on function public.api_complete_personal_task(uuid,uuid)
  from public,anon,authenticated;

grant execute on function public.api_create_personal_task(uuid,text,text,date,date,text)
  to service_role;
grant execute on function public.api_edit_personal_task(uuid,uuid,text,text,date,text)
  to service_role;
grant execute on function public.api_change_personal_task_deadline(uuid,uuid,date,text)
  to service_role;
grant execute on function public.api_cancel_personal_task(uuid,uuid,text)
  to service_role;
grant execute on function public.api_complete_personal_task(uuid,uuid)
  to service_role;

alter function public.api_assert_personal_task_owner(uuid,uuid,boolean) owner to postgres;
alter function public.api_create_personal_task(uuid,text,text,date,date,text) owner to postgres;
alter function public.api_edit_personal_task(uuid,uuid,text,text,date,text) owner to postgres;
alter function public.api_change_personal_task_deadline(uuid,uuid,date,text) owner to postgres;
alter function public.api_cancel_personal_task(uuid,uuid,text) owner to postgres;
alter function public.api_complete_personal_task(uuid,uuid) owner to postgres;
begin;

alter table public.task_recurrence_rules
  add column if not exists task_type text not null default 'assigned',
  add column if not exists start_offset_days integer not null default 0;

alter table public.task_recurrence_rules drop constraint if exists task_recurrence_rules_task_type_check;
alter table public.task_recurrence_rules add constraint task_recurrence_rules_task_type_check
  check (task_type in ('assigned','personal'));
alter table public.task_recurrence_rules drop constraint if exists task_recurrence_rules_start_offset_check;
alter table public.task_recurrence_rules add constraint task_recurrence_rules_start_offset_check
  check (start_offset_days between 0 and 3650);

create or replace function public.api_create_personal_task_v2(
  p_actor_id uuid,p_title text,p_description text,p_start_date date,p_due_date date,
  p_evaluation_criteria text default null,p_recurrence_frequency text default null,
  p_recurrence_ends_on date default null
) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_task public.tasks; v_rule public.task_recurrence_rules; v_department uuid; v_month_end boolean;
begin
  select department_id into v_department from public.staff_users where id=p_actor_id and active=true;
  if not found then raise exception 'Invalid task actor.' using errcode='42501'; end if;
  if nullif(btrim(p_title),'') is null or length(p_title)>500
     or nullif(btrim(p_description),'') is null or length(p_description)>10000
     or p_start_date is null or p_due_date is null or p_start_date>p_due_date
     or length(coalesce(p_evaluation_criteria,''))>10000
     or (p_recurrence_frequency is not null and p_recurrence_frequency not in ('daily','weekly','monthly'))
     or (p_recurrence_frequency is null and p_recurrence_ends_on is not null)
     or (p_recurrence_ends_on is not null and p_recurrence_ends_on<p_due_date) then
    raise exception 'Invalid personal task input.' using errcode='22023';
  end if;
  insert into public.tasks(title,description,status,progress_percent,assignee_id,owner_id,
    assignment_mode,created_by,department_id,due_date,plan_period,self_claimable,task_type,
    start_date,evaluation_criteria)
  values(btrim(p_title),btrim(p_description),'new',0,p_actor_id,p_actor_id,'individual',
    p_actor_id,v_department,p_due_date,'ad_hoc',false,'personal',p_start_date,
    nullif(btrim(p_evaluation_criteria),'')) returning * into v_task;
  insert into public.task_assignees(task_id,user_id,assignment_role,status)
  values(v_task.id,p_actor_id,'owner','todo') on conflict(task_id,user_id) do update set assignment_role='owner',status='todo';
  if p_recurrence_frequency is not null then
    v_month_end := p_recurrence_frequency='monthly' and p_due_date=(date_trunc('month',p_due_date)::date+interval '1 month - 1 day')::date;
    insert into public.task_recurrence_rules(title,description,department_id,assignee_id,reviewer_id,
      evaluation_criteria,collaborator_ids,watcher_ids,frequency,weekday,day_of_month,month_end,
      starts_on,ends_on,next_scheduled_for,created_by,task_type,start_offset_days)
    values(btrim(p_title),btrim(p_description),v_department,p_actor_id,null,
      nullif(btrim(p_evaluation_criteria),''),'{}','{}',p_recurrence_frequency,
      case when p_recurrence_frequency='weekly' then extract(isodow from p_due_date)::smallint end,
      case when p_recurrence_frequency='monthly' then extract(day from p_due_date)::smallint end,
      v_month_end,p_due_date,p_recurrence_ends_on,
      public.task_recurrence_next_date(p_recurrence_frequency,extract(isodow from p_due_date)::smallint,
        extract(day from p_due_date)::smallint,v_month_end,p_due_date),p_actor_id,'personal',p_due_date-p_start_date)
    returning * into v_rule;
    update public.tasks set recurrence_rule_id=v_rule.id where id=v_task.id returning * into v_task;
    insert into public.task_recurrence_occurrences(rule_id,scheduled_for,task_id) values(v_rule.id,p_due_date,v_task.id);
  end if;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor_id,'task','tasks',v_task.id,'create',jsonb_build_object('task_type','personal','recurring',p_recurrence_frequency is not null));
  return v_task;
end
$function$;

create or replace function public.api_run_task_recurrence(p_run_on date default null)
returns integer language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_run_on date:=coalesce(p_run_on,timezone('Asia/Ho_Chi_Minh',now())::date); v_rule public.task_recurrence_rules;
  v_scheduled date; v_task public.tasks; v_manager uuid; v_user uuid; v_created integer:=0;
begin
  for v_rule in select * from public.task_recurrence_rules where active=true and next_scheduled_for<=v_run_on order by next_scheduled_for,id for update skip locked loop
    if v_rule.task_type='assigned' then
      select manager_id into v_manager from public.departments where id=v_rule.department_id and active=true;
      if v_manager is null then raise exception 'Recurrence department requires a primary manager.' using errcode='22023'; end if;
    end if;
    v_scheduled:=v_rule.next_scheduled_for;
    while v_scheduled<=v_run_on and (v_rule.ends_on is null or v_scheduled<=v_rule.ends_on) loop
      if not exists(select 1 from public.task_recurrence_occurrences where rule_id=v_rule.id and scheduled_for=v_scheduled) then
        insert into public.tasks(title,description,department_id,assignee_id,owner_id,reviewer_id,created_by,
          assignment_mode,due_date,due_time,status,progress_percent,plan_period,self_claimable,task_type,start_date,
          evaluation_criteria,recurrence_rule_id)
        values(v_rule.title,v_rule.description,v_rule.department_id,v_rule.assignee_id,v_rule.assignee_id,
          case when v_rule.task_type='assigned' then v_rule.reviewer_id else null end,v_rule.created_by,
          case when v_rule.task_type='assigned' and cardinality(v_rule.collaborator_ids)>0 then 'multi_user' else 'individual' end,
          v_scheduled,v_rule.due_time,'new',0,'ad_hoc',false,v_rule.task_type,
          case when v_rule.task_type='personal' then v_scheduled-v_rule.start_offset_days else v_scheduled end,
          v_rule.evaluation_criteria,v_rule.id) returning * into v_task;
        insert into public.task_assignees(task_id,user_id,assignment_role,status)
        values(v_task.id,v_rule.assignee_id,'owner','todo');
        if v_rule.task_type='assigned' then
          foreach v_user in array v_rule.collaborator_ids loop
            if v_user<>v_rule.assignee_id then insert into public.task_assignees(task_id,user_id,assignment_role,status) values(v_task.id,v_user,'assignee','todo') on conflict(task_id,user_id) do nothing; end if;
          end loop;
          if v_manager<>v_rule.assignee_id and not(v_manager=any(v_rule.collaborator_ids)) then insert into public.task_assignees(task_id,user_id,assignment_role,status) values(v_task.id,v_manager,'watcher','todo') on conflict(task_id,user_id) do nothing; end if;
          foreach v_user in array v_rule.watcher_ids loop
            if v_user<>v_rule.assignee_id and not(v_user=any(v_rule.collaborator_ids)) then insert into public.task_assignees(task_id,user_id,assignment_role,status) values(v_task.id,v_user,'watcher','todo') on conflict(task_id,user_id) do nothing; end if;
          end loop;
        end if;
        insert into public.task_recurrence_occurrences(rule_id,scheduled_for,task_id) values(v_rule.id,v_scheduled,v_task.id);
        insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(v_rule.created_by,'task','tasks',v_task.id,'create',jsonb_build_object('recurrence_rule_id',v_rule.id,'scheduled_for',v_scheduled,'task_type',v_rule.task_type));
        v_created:=v_created+1;
      end if;
      v_scheduled:=public.task_recurrence_next_date(v_rule.frequency,v_rule.weekday,v_rule.day_of_month,v_rule.month_end,v_scheduled);
    end loop;
    update public.task_recurrence_rules set next_scheduled_for=v_scheduled,active=case when ends_on is not null and v_scheduled>ends_on then false else active end,updated_at=now() where id=v_rule.id;
  end loop;
  return v_created;
end
$function$;

create or replace function public.api_admin_edit_task(p_actor_id uuid,p_task_id uuid,p_title text,
  p_description text,p_start_date date,p_due_date date,p_due_time time,p_priority text,p_status text,
  p_evaluation_criteria text,p_reason text) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_before public.tasks; v_after public.tasks;
begin
  if not exists(select 1 from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor_id and u.active and r.active and r.code='admin') then raise exception 'Admin task edit forbidden.' using errcode='42501'; end if;
  select * into v_before from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
  if nullif(btrim(p_title),'') is null or length(p_title)>500 or nullif(btrim(p_description),'') is null or length(p_description)>10000
     or p_start_date is null or p_due_date is null or p_start_date>p_due_date
     or p_priority not in ('low','normal','high','urgent')
     or p_status not in ('new','in_progress','blocked','waiting','pending_review','done','rejected','cancelled')
     or length(coalesce(p_evaluation_criteria,''))>10000 or nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then raise exception 'Invalid admin task edit.' using errcode='22023'; end if;
  update public.tasks set title=btrim(p_title),description=btrim(p_description),start_date=p_start_date,
    due_date=p_due_date,due_time=p_due_time,priority=p_priority,status=p_status,
    evaluation_criteria=nullif(btrim(p_evaluation_criteria),''),
    completion_submitted_at=case when p_status='done' then coalesce(completion_submitted_at,now()) else completion_submitted_at end,
    completed_at=case when p_status='done' then coalesce(completed_at,now()) else null end,
    cancelled_at=case when p_status='cancelled' then coalesce(cancelled_at,now()) else null end,
    cancelled_by=case when p_status='cancelled' then p_actor_id else null end,
    cancel_reason=case when p_status='cancelled' then btrim(p_reason) else null end,updated_at=now()
  where id=p_task_id returning * into v_after;
  if v_before.due_date is distinct from p_due_date then insert into public.task_deadline_history(task_id,old_due_date,new_due_date,reason,changed_by) values(p_task_id,v_before.due_date,p_due_date,btrim(p_reason),p_actor_id); end if;
  if v_before.status is distinct from p_status then insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id) values(p_task_id,v_before.status,p_status,btrim(p_reason),p_actor_id); end if;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor_id,'task','tasks',p_task_id,'admin_edit',to_jsonb(v_before),to_jsonb(v_after)||jsonb_build_object('reason',btrim(p_reason)));
  return v_after;
end
$function$;

revoke all on function public.api_create_personal_task_v2(uuid,text,text,date,date,text,text,date) from public,anon,authenticated;
revoke all on function public.api_admin_edit_task(uuid,uuid,text,text,date,date,time,text,text,text,text) from public,anon,authenticated;
grant execute on function public.api_create_personal_task_v2(uuid,text,text,date,date,text,text,date) to service_role;
grant execute on function public.api_admin_edit_task(uuid,uuid,text,text,date,date,time,text,text,text,text) to service_role;
alter function public.api_create_personal_task_v2(uuid,text,text,date,date,text,text,date) owner to postgres;
alter function public.api_admin_edit_task(uuid,uuid,text,text,date,date,time,text,text,text,text) owner to postgres;
notify pgrst,'reload schema';
commit;

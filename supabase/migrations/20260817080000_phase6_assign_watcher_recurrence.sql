-- Phase 6: canonical assignment, manager/extra watchers and idempotent recurrence.

alter table public.task_recurrence_rules
  add column if not exists reviewer_id uuid references public.staff_users(id),
  add column if not exists collaborator_ids uuid[] not null default '{}'::uuid[],
  add column if not exists watcher_ids uuid[] not null default '{}'::uuid[],
  add column if not exists month_end boolean not null default false;

create or replace function public.task_recurrence_next_date(
  p_frequency text,p_weekday smallint,p_day_of_month smallint,
  p_month_end boolean,p_after date
) returns date
language plpgsql immutable set search_path=public,pg_temp
as $function$
declare
  v_month date;
  v_last date;
begin
  if p_frequency='weekly' then
    return p_after + 7;
  end if;
  if p_frequency<>'monthly' then
    raise exception 'Invalid recurrence frequency.' using errcode='22023';
  end if;
  v_month := (date_trunc('month',p_after)::date + interval '1 month')::date;
  v_last := (v_month + interval '1 month - 1 day')::date;
  if p_month_end then return v_last; end if;
  return make_date(
    extract(year from v_month)::integer,
    extract(month from v_month)::integer,
    least(p_day_of_month::integer,extract(day from v_last)::integer)
  );
end
$function$;

create or replace function public.api_assign_task(
  p_actor_id uuid,p_title text,p_description text,p_department_id uuid,
  p_assignee_id uuid,p_reviewer_id uuid,p_due_date date,
  p_evaluation_criteria text default null,
  p_collaborator_ids uuid[] default '{}'::uuid[],
  p_watcher_ids uuid[] default '{}'::uuid[],
  p_recurrence_frequency text default null,
  p_recurrence_ends_on date default null
) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_task public.tasks;
  v_rule public.task_recurrence_rules;
  v_actor_role text;
  v_actor_department uuid;
  v_manager uuid;
  v_user uuid;
  v_month_end boolean;
begin
  perform public.api_assert_task_action(p_actor_id,null,'assign');
  select r.code,u.department_id into v_actor_role,v_actor_department
  from public.staff_users u join public.roles r on r.id=u.role_id
  where u.id=p_actor_id and u.active=true;
  if v_actor_role not in ('admin','pho_tong_bien_tap')
     and (v_actor_department is null or p_department_id<>v_actor_department) then
    raise exception 'Assignment is outside actor scope.' using errcode='42501';
  end if;
  if nullif(btrim(p_title),'') is null or length(p_title)>500
     or nullif(btrim(p_description),'') is null or length(p_description)>10000
     or p_due_date is null
     or (p_evaluation_criteria is not null and length(p_evaluation_criteria)>10000)
     or (p_recurrence_frequency is not null and p_recurrence_frequency not in ('weekly','monthly'))
     or (p_recurrence_frequency is null and p_recurrence_ends_on is not null)
     or (p_recurrence_ends_on is not null and p_recurrence_ends_on<p_due_date) then
    raise exception 'Invalid assignment input.' using errcode='22023';
  end if;
  select manager_id into v_manager from public.departments
  where id=p_department_id and active=true;
  if v_manager is null then
    raise exception 'Assignee department requires a primary manager.' using errcode='22023';
  end if;
  if not exists(select 1 from public.staff_users where id=p_assignee_id and active=true and department_id=p_department_id)
     or not exists(select 1 from public.staff_users where id=p_reviewer_id and active=true)
     or not exists(select 1 from public.staff_users where id=v_manager and active=true) then
    raise exception 'Invalid assignee, reviewer or manager.' using errcode='22023';
  end if;
  if exists(
    select 1 from unnest(coalesce(p_collaborator_ids,'{}'::uuid[]) || coalesce(p_watcher_ids,'{}'::uuid[])) x(id)
    where not exists(select 1 from public.staff_users u where u.id=x.id and u.active=true)
  ) then raise exception 'Inactive assignment participant.' using errcode='22023'; end if;

  insert into public.tasks(
    title,description,department_id,assignee_id,owner_id,reviewer_id,created_by,
    assignment_mode,due_date,status,progress_percent,plan_period,self_claimable,
    task_type,start_date,evaluation_criteria
  ) values(
    btrim(p_title),btrim(p_description),p_department_id,p_assignee_id,p_assignee_id,
    p_reviewer_id,p_actor_id,
    case when cardinality(coalesce(p_collaborator_ids,'{}'::uuid[]))>0 then 'multi_user' else 'individual' end,
    p_due_date,'new',0,'ad_hoc',false,'assigned',timezone('Asia/Ho_Chi_Minh',now())::date,
    nullif(btrim(p_evaluation_criteria),'')
  ) returning * into v_task;

  insert into public.task_assignees(task_id,user_id,assignment_role,status)
  values(v_task.id,p_assignee_id,'owner','todo');
  foreach v_user in array coalesce(p_collaborator_ids,'{}'::uuid[]) loop
    if v_user<>p_assignee_id then
      insert into public.task_assignees(task_id,user_id,assignment_role,status)
      values(v_task.id,v_user,'assignee','todo') on conflict(task_id,user_id) do nothing;
    end if;
  end loop;
  if v_manager<>p_assignee_id and not (v_manager=any(coalesce(p_collaborator_ids,'{}'::uuid[]))) then
    insert into public.task_assignees(task_id,user_id,assignment_role,status)
    values(v_task.id,v_manager,'watcher','todo') on conflict(task_id,user_id) do nothing;
  end if;
  foreach v_user in array coalesce(p_watcher_ids,'{}'::uuid[]) loop
    if v_user<>p_assignee_id and not (v_user=any(coalesce(p_collaborator_ids,'{}'::uuid[]))) then
      insert into public.task_assignees(task_id,user_id,assignment_role,status)
      values(v_task.id,v_user,'watcher','todo') on conflict(task_id,user_id) do nothing;
    end if;
  end loop;

  if p_recurrence_frequency is not null then
    v_month_end := p_recurrence_frequency='monthly'
      and p_due_date=(date_trunc('month',p_due_date)::date + interval '1 month - 1 day')::date;
    insert into public.task_recurrence_rules(
      title,description,department_id,assignee_id,reviewer_id,evaluation_criteria,
      collaborator_ids,watcher_ids,frequency,weekday,day_of_month,month_end,
      starts_on,ends_on,next_scheduled_for,created_by
    ) values(
      btrim(p_title),btrim(p_description),p_department_id,p_assignee_id,p_reviewer_id,
      nullif(btrim(p_evaluation_criteria),''),coalesce(p_collaborator_ids,'{}'::uuid[]),
      coalesce(p_watcher_ids,'{}'::uuid[]),p_recurrence_frequency,
      case when p_recurrence_frequency='weekly' then extract(isodow from p_due_date)::smallint end,
      case when p_recurrence_frequency='monthly' then extract(day from p_due_date)::smallint end,
      v_month_end,p_due_date,p_recurrence_ends_on,
      public.task_recurrence_next_date(
        p_recurrence_frequency,extract(isodow from p_due_date)::smallint,
        extract(day from p_due_date)::smallint,v_month_end,p_due_date
      ),p_actor_id
    ) returning * into v_rule;
    update public.tasks set recurrence_rule_id=v_rule.id where id=v_task.id returning * into v_task;
    insert into public.task_recurrence_occurrences(rule_id,scheduled_for,task_id)
    values(v_rule.id,p_due_date,v_task.id);
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
    values(p_actor_id,'task','task_recurrence_rules',v_rule.id,'create',jsonb_build_object('frequency',p_recurrence_frequency,'first_due_date',p_due_date));
  end if;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor_id,'task','tasks',v_task.id,'create',jsonb_build_object('task_type','assigned','manager_watcher_id',v_manager,'recurring',p_recurrence_frequency is not null));
  return v_task;
end
$function$;

create or replace function public.api_run_task_recurrence(p_run_on date default null)
returns integer
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_run_on date := coalesce(p_run_on,timezone('Asia/Ho_Chi_Minh',now())::date);
  v_rule public.task_recurrence_rules;
  v_scheduled date;
  v_task public.tasks;
  v_manager uuid;
  v_user uuid;
  v_created integer := 0;
begin
  for v_rule in
    select * from public.task_recurrence_rules
    where active=true and next_scheduled_for<=v_run_on
    order by next_scheduled_for,id for update skip locked
  loop
    select manager_id into v_manager from public.departments where id=v_rule.department_id and active=true;
    if v_manager is null then
      raise exception 'Recurrence department requires a primary manager.' using errcode='22023';
    end if;
    v_scheduled := v_rule.next_scheduled_for;
    while v_scheduled<=v_run_on and (v_rule.ends_on is null or v_scheduled<=v_rule.ends_on) loop
      if not exists(select 1 from public.task_recurrence_occurrences where rule_id=v_rule.id and scheduled_for=v_scheduled) then
        insert into public.tasks(
          title,description,department_id,assignee_id,owner_id,reviewer_id,created_by,
          assignment_mode,due_date,status,progress_percent,plan_period,self_claimable,
          task_type,start_date,evaluation_criteria,recurrence_rule_id
        ) values(
          v_rule.title,v_rule.description,v_rule.department_id,v_rule.assignee_id,
          v_rule.assignee_id,v_rule.reviewer_id,v_rule.created_by,
          case when cardinality(v_rule.collaborator_ids)>0 then 'multi_user' else 'individual' end,
          v_scheduled,'new',0,'ad_hoc',false,'assigned',v_scheduled,
          v_rule.evaluation_criteria,v_rule.id
        ) returning * into v_task;
        insert into public.task_assignees(task_id,user_id,assignment_role,status)
        values(v_task.id,v_rule.assignee_id,'owner','todo');
        foreach v_user in array v_rule.collaborator_ids loop
          if v_user<>v_rule.assignee_id then
            insert into public.task_assignees(task_id,user_id,assignment_role,status)
            values(v_task.id,v_user,'assignee','todo') on conflict(task_id,user_id) do nothing;
          end if;
        end loop;
        if v_manager<>v_rule.assignee_id and not (v_manager=any(v_rule.collaborator_ids)) then
          insert into public.task_assignees(task_id,user_id,assignment_role,status)
          values(v_task.id,v_manager,'watcher','todo') on conflict(task_id,user_id) do nothing;
        end if;
        foreach v_user in array v_rule.watcher_ids loop
          if v_user<>v_rule.assignee_id and not (v_user=any(v_rule.collaborator_ids)) then
            insert into public.task_assignees(task_id,user_id,assignment_role,status)
            values(v_task.id,v_user,'watcher','todo') on conflict(task_id,user_id) do nothing;
          end if;
        end loop;
        insert into public.task_recurrence_occurrences(rule_id,scheduled_for,task_id)
        values(v_rule.id,v_scheduled,v_task.id);
        insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
        values(v_rule.created_by,'task','tasks',v_task.id,'create',jsonb_build_object('recurrence_rule_id',v_rule.id,'scheduled_for',v_scheduled));
        v_created := v_created+1;
      end if;
      v_scheduled := public.task_recurrence_next_date(v_rule.frequency,v_rule.weekday,v_rule.day_of_month,v_rule.month_end,v_scheduled);
    end loop;
    update public.task_recurrence_rules set
      next_scheduled_for=v_scheduled,
      active=case when ends_on is not null and v_scheduled>ends_on then false else active end,
      updated_at=now()
    where id=v_rule.id;
  end loop;
  return v_created;
end
$function$;

revoke all on function public.task_recurrence_next_date(text,smallint,smallint,boolean,date) from public,anon,authenticated;
revoke all on function public.api_assign_task(uuid,text,text,uuid,uuid,uuid,date,text,uuid[],uuid[],text,date) from public,anon,authenticated;
revoke all on function public.api_run_task_recurrence(date) from public,anon,authenticated;
grant execute on function public.api_assign_task(uuid,text,text,uuid,uuid,uuid,date,text,uuid[],uuid[],text,date) to service_role;
grant execute on function public.api_run_task_recurrence(date) to service_role;
alter function public.task_recurrence_next_date(text,smallint,smallint,boolean,date) owner to postgres;
alter function public.api_assign_task(uuid,text,text,uuid,uuid,uuid,date,text,uuid[],uuid[],text,date) owner to postgres;
alter function public.api_run_task_recurrence(date) owner to postgres;

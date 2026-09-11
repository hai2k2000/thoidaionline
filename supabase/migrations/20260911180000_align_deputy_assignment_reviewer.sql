begin;

-- Align the database assignee scope with the server/UI leadership mapping.
-- Department heads remain members of their own department, but are also
-- valid assignees when the selected assignment department is leadership.
create or replace function public.api_assign_task_v2(
  p_actor_id uuid,p_title text,p_description text,p_department_id uuid,
  p_assignee_id uuid,p_reviewer_id uuid,p_due_date date,p_due_time time,
  p_evaluation_criteria text default null,
  p_collaborator_ids uuid[] default '{}'::uuid[],
  p_watcher_ids uuid[] default '{}'::uuid[],
  p_recurrence_frequency text default null,
  p_recurrence_ends_on date default null,
  p_priority text default 'normal'
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
  if v_actor_role not in ('admin','tong_bien_tap','pho_tong_bien_tap')
     and (v_actor_department is null or p_department_id<>v_actor_department) then
    raise exception 'Assignment is outside actor scope.' using errcode='42501';
  end if;
  if nullif(btrim(p_title),'') is null or length(p_title)>500
     or nullif(btrim(p_description),'') is null or length(p_description)>10000
     or p_due_date is null or p_due_time is null
     or p_priority not in ('low','normal','high','urgent')
     or (p_evaluation_criteria is not null and length(p_evaluation_criteria)>10000)
     or (p_recurrence_frequency is not null and p_recurrence_frequency not in ('daily','weekly','monthly'))
     or (p_recurrence_frequency is null and p_recurrence_ends_on is not null)
     or (p_recurrence_ends_on is not null and p_recurrence_ends_on<p_due_date) then
    raise exception 'Invalid assignment input.' using errcode='22023';
  end if;
  select manager_id into v_manager from public.departments
  where id=p_department_id and active=true;
  if v_manager is null then
    raise exception 'Assignee department requires a primary manager.' using errcode='22023';
  end if;
  if not exists(
    select 1
    from public.staff_users u
    left join public.job_titles jt on jt.id=u.job_title_id
    left join public.roles rr on rr.id=u.role_id
    where u.id=p_assignee_id and u.active=true
      and (
        u.department_id=p_department_id
        or exists(
          select 1 from public.departments ld
          where ld.id=p_department_id and ld.active=true and ld.code='leadership'
            and (
              lower(coalesce(rr.code,''))='pho_tong_bien_tap'
              or lower(coalesce(jt.code,''))='truong_phong'
            )
        )
      )
  )
     or not exists(
       select 1
       from public.staff_users u
       left join public.job_titles jt on jt.id=u.job_title_id
       left join public.roles rr on rr.id=u.role_id
       where u.id=p_reviewer_id and u.active=true
         and ((u.department_id=p_department_id and (u.id=v_manager
              or (jt.active=true and lower(jt.code) in ('truong_phong','pho_truong_phong'))
              or lower(coalesce(rr.code,'')) in ('truong_phong','pho_truong_phong')))
            or lower(coalesce(rr.code,'')) in ('tong_bien_tap','pho_tong_bien_tap'))
     )
     or not exists(select 1 from public.staff_users where id=v_manager and active=true) then
    raise exception 'Invalid assignee, reviewer or manager.' using errcode='22023';
  end if;
  if exists(
    select 1 from unnest(coalesce(p_collaborator_ids,'{}'::uuid[]) || coalesce(p_watcher_ids,'{}'::uuid[])) x(id)
    where not exists(select 1 from public.staff_users u where u.id=x.id and u.active=true)
  ) then raise exception 'Inactive assignment participant.' using errcode='22023'; end if;

  insert into public.tasks(
    title,description,department_id,assignee_id,owner_id,reviewer_id,created_by,
    assignment_mode,due_date,due_time,status,progress_percent,plan_period,self_claimable,
    task_type,start_date,evaluation_criteria,priority
  ) values(
    btrim(p_title),btrim(p_description),p_department_id,p_assignee_id,p_assignee_id,
    p_reviewer_id,p_actor_id,
    case when cardinality(coalesce(p_collaborator_ids,'{}'::uuid[]))>0 then 'multi_user' else 'individual' end,
    p_due_date,p_due_time,'new',0,'ad_hoc',false,'assigned',timezone('Asia/Ho_Chi_Minh',now())::date,
    nullif(btrim(p_evaluation_criteria),''),p_priority
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
      starts_on,ends_on,next_scheduled_for,due_time,created_by,priority
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
      ),p_due_time,p_actor_id,p_priority
    ) returning * into v_rule;
    update public.tasks set recurrence_rule_id=v_rule.id where id=v_task.id returning * into v_task;
    insert into public.task_recurrence_occurrences(rule_id,scheduled_for,task_id)
    values(v_rule.id,p_due_date,v_task.id);
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
    values(p_actor_id,'task','task_recurrence_rules',v_rule.id,'create',jsonb_build_object('frequency',p_recurrence_frequency,'first_due_date',p_due_date,'due_time',p_due_time));
  end if;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor_id,'task','tasks',v_task.id,'create',jsonb_build_object('task_type','assigned','manager_watcher_id',v_manager,'recurring',p_recurrence_frequency is not null,'due_time',p_due_time));
  return v_task;
end
$function$;

revoke all on function public.api_assign_task_v2(uuid,text,text,uuid,uuid,uuid,date,time,text,uuid[],uuid[],text,date,text) from public,anon,authenticated;
grant execute on function public.api_assign_task_v2(uuid,text,text,uuid,uuid,uuid,date,time,text,uuid[],uuid[],text,date,text) to service_role;
alter function public.api_assign_task_v2(uuid,text,text,uuid,uuid,uuid,date,time,text,uuid[],uuid[],text,date,text) owner to postgres;

commit;

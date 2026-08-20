begin;

alter table public.tasks
  add column if not exists due_time time without time zone;

alter table public.task_recurrence_rules
  add column if not exists due_time time without time zone;

alter table public.task_recurrence_rules
  drop constraint if exists task_recurrence_rules_frequency_check,
  drop constraint if exists task_recurrence_rules_schedule_check;

alter table public.task_recurrence_rules
  add constraint task_recurrence_rules_frequency_check
    check (frequency in ('daily','weekly','monthly')),
  add constraint task_recurrence_rules_schedule_check check (
    (frequency='daily' and weekday is null and day_of_month is null)
    or (frequency='weekly' and weekday is not null and day_of_month is null)
    or (frequency='monthly' and day_of_month is not null and weekday is null)
  );

create or replace function public.validate_task_report_recipient()
returns trigger
language plpgsql
set search_path=public
as $function$
declare
  v_job_title text;
  v_role text;
  v_active boolean;
  v_department uuid;
begin
  if new.reviewer_id is not null then
    select lower(jt.code),lower(r.code),u.active,u.department_id
    into v_job_title,v_role,v_active,v_department
    from public.staff_users u
    join public.roles r on r.id=u.role_id
    left join public.job_titles jt on jt.id=u.job_title_id and jt.active=true
    where u.id=new.reviewer_id;

    if not coalesce(v_active,false) then
      raise exception 'Người duyệt không hợp lệ.' using errcode='22023';
    end if;
    if new.reviewer_id=(select manager_id from public.departments where id=new.department_id and active=true) then
      null;
    elsif v_job_title in ('truong_phong','pho_truong_phong') then
      if v_department is distinct from new.department_id then
        raise exception 'Người duyệt phải thuộc phòng ban của công việc.' using errcode='42501';
      end if;
    elsif v_role not in ('phu_trach_phong_tri_su','phu_trach_phong_phong_vien',
      'phu_trach_phong_bien_tap','pho_tong_bien_tap','tong_bien_tap') then
      raise exception 'Người duyệt phải là Trưởng hoặc Phó phòng.' using errcode='42501';
    end if;
  end if;
  if new.self_claimable and new.assignment_mode<>'individual' then
    raise exception 'Kế hoạch tự nhận chỉ hỗ trợ kiểu giao cá nhân.' using errcode='22023';
  end if;
  return new;
end
$function$;

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
  if p_frequency='daily' then return p_after + 1; end if;
  if p_frequency='weekly' then return p_after + 7; end if;
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

create or replace function public.api_assign_task_v2(
  p_actor_id uuid,p_title text,p_description text,p_department_id uuid,
  p_assignee_id uuid,p_reviewer_id uuid,p_due_date date,p_due_time time,
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
     or p_due_date is null or p_due_time is null
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
  if not exists(select 1 from public.staff_users where id=p_assignee_id and active=true and department_id=p_department_id)
     or not exists(
       select 1 from public.staff_users u left join public.job_titles jt on jt.id=u.job_title_id
       where u.id=p_reviewer_id and u.active=true and u.department_id=p_department_id
         and (u.id=v_manager or (jt.active=true and lower(jt.code) in ('truong_phong','pho_truong_phong')))
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
    task_type,start_date,evaluation_criteria
  ) values(
    btrim(p_title),btrim(p_description),p_department_id,p_assignee_id,p_assignee_id,
    p_reviewer_id,p_actor_id,
    case when cardinality(coalesce(p_collaborator_ids,'{}'::uuid[]))>0 then 'multi_user' else 'individual' end,
    p_due_date,p_due_time,'new',0,'ad_hoc',false,'assigned',timezone('Asia/Ho_Chi_Minh',now())::date,
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
      starts_on,ends_on,next_scheduled_for,due_time,created_by
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
      ),p_due_time,p_actor_id
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
          assignment_mode,due_date,due_time,status,progress_percent,plan_period,self_claimable,
          task_type,start_date,evaluation_criteria,recurrence_rule_id
        ) values(
          v_rule.title,v_rule.description,v_rule.department_id,v_rule.assignee_id,
          v_rule.assignee_id,v_rule.reviewer_id,v_rule.created_by,
          case when cardinality(v_rule.collaborator_ids)>0 then 'multi_user' else 'individual' end,
          v_scheduled,v_rule.due_time,'new',0,'ad_hoc',false,'assigned',v_scheduled,
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
        values(v_rule.created_by,'task','tasks',v_task.id,'create',jsonb_build_object('recurrence_rule_id',v_rule.id,'scheduled_for',v_scheduled,'due_time',v_rule.due_time));
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

revoke all on function public.api_assign_task_v2(uuid,text,text,uuid,uuid,uuid,date,time,text,uuid[],uuid[],text,date) from public,anon,authenticated;
grant execute on function public.api_assign_task_v2(uuid,text,text,uuid,uuid,uuid,date,time,text,uuid[],uuid[],text,date) to service_role;
alter function public.api_assign_task_v2(uuid,text,text,uuid,uuid,uuid,date,time,text,uuid[],uuid[],text,date) owner to postgres;

notify pgrst, 'reload schema';

commit;

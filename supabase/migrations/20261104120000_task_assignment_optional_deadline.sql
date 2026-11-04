begin;

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
  p_due_time := case when p_due_date is null then null else coalesce(p_due_time,time '17:00') end;
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
     or (p_recurrence_frequency is not null and p_due_date is null)
     or p_priority not in ('low','normal','high','urgent')
     or (p_evaluation_criteria is not null and length(p_evaluation_criteria)>10000)
     or (p_recurrence_frequency is not null and p_recurrence_frequency not in ('daily','weekly','monthly'))
     or (p_recurrence_frequency is null and p_recurrence_ends_on is not null)
     or (p_recurrence_ends_on is not null and p_recurrence_ends_on<p_due_date) then
    raise exception 'Invalid assignment input.' using errcode='22023';
  end if;
  select manager_id into v_manager from public.departments
  where id=p_department_id and active=true;
  if v_manager is null and v_actor_role<>'tong_bien_tap' then
    raise exception 'Assignee department requires a primary manager.' using errcode='22023';
  end if;
  if not exists(
    select 1
    from public.staff_users u
    left join public.job_titles jt on jt.id=u.job_title_id
    left join public.roles rr on rr.id=u.role_id
    where u.id=p_assignee_id and u.active=true
      and (
      v_actor_role='tong_bien_tap'
      or u.department_id=p_department_id
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
     or (v_actor_role<>'tong_bien_tap' and not exists(select 1 from public.staff_users where id=v_manager and active=true)) then
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
  if v_manager is not null and v_manager<>p_assignee_id and not (v_manager=any(coalesce(p_collaborator_ids,'{}'::uuid[]))) then
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

create or replace function public.api_assign_task_batch_v1(
  p_actor_id uuid,
  p_batch_id uuid,
  p_department_id uuid,
  p_assignee_id uuid,
  p_tasks jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_existing public.task_assignment_batch_idempotency;
  v_item jsonb;
  v_ordinal bigint;
  v_task public.tasks;
  v_task_ids uuid[] := '{}'::uuid[];
  v_task_results jsonb := '[]'::jsonb;
  v_collaborator_ids uuid[];
  v_watcher_ids uuid[];
  v_request_hash text;
  v_priority text;
  v_due_date date;
  v_due_time time;
  v_recurrence_frequency text;
  v_recurrence_ends_on date;
  v_count integer;
begin
  if p_actor_id is null or p_batch_id is null or p_department_id is null or p_assignee_id is null
     or p_tasks is null or jsonb_typeof(p_tasks) <> 'array' then
    raise exception 'Invalid task assignment batch.' using errcode='22023';
  end if;

  v_count := jsonb_array_length(p_tasks);
  if v_count < 1 or v_count > 20 then
    raise exception 'Task assignment batch must contain between 1 and 20 tasks.' using errcode='22023';
  end if;

  -- Validate every card before invoking any mutating task function. This keeps
  -- ordinary malformed-card failures from creating an earlier partial prefix.
  for v_item, v_ordinal in
    select value, ordinality
    from jsonb_array_elements(p_tasks) with ordinality
  loop
    if jsonb_typeof(v_item) <> 'object'
       or nullif(btrim(v_item->>'title'), '') is null
       or length(v_item->>'title') > 500
       or nullif(btrim(v_item->>'description'), '') is null
       or length(v_item->>'description') > 10000
       then
      raise exception 'Invalid batch task payload at ordinal %.', v_ordinal using errcode='22023';
    end if;

    v_due_date := (v_item->>'due_date')::date;
    v_due_time := (v_item->>'due_time')::time;
    v_priority := coalesce(nullif(v_item->>'priority', ''), 'normal');
    if v_priority not in ('low', 'normal', 'high', 'urgent') then
      raise exception 'Invalid batch task priority at ordinal %.', v_ordinal using errcode='22023';
    end if;

    if v_item ? 'collaborator_ids' and jsonb_typeof(v_item->'collaborator_ids') <> 'array' then
      raise exception 'Invalid batch collaborators at ordinal %.', v_ordinal using errcode='22023';
    end if;
    if v_item ? 'watcher_ids' and jsonb_typeof(v_item->'watcher_ids') <> 'array' then
      raise exception 'Invalid batch watchers at ordinal %.', v_ordinal using errcode='22023';
    end if;
    v_collaborator_ids := coalesce(
      array(select value::uuid from jsonb_array_elements_text(coalesce(v_item->'collaborator_ids', '[]'::jsonb))),
      '{}'::uuid[]
    );
    v_watcher_ids := coalesce(
      array(select value::uuid from jsonb_array_elements_text(coalesce(v_item->'watcher_ids', '[]'::jsonb))),
      '{}'::uuid[]
    );
    v_recurrence_frequency := nullif(v_item->>'recurrence_frequency', '');
    v_recurrence_ends_on := nullif(v_item->>'recurrence_ends_on', '')::date;
    if v_recurrence_frequency is not null and v_due_date is null then
      raise exception 'Recurrence requires a due date at ordinal %.', v_ordinal using errcode='22023';
    end if;
    if v_recurrence_frequency is not null and v_recurrence_frequency not in ('daily', 'weekly', 'monthly') then
      raise exception 'Invalid batch recurrence at ordinal %.', v_ordinal using errcode='22023';
    end if;
    if v_recurrence_frequency is null and v_recurrence_ends_on is not null then
      raise exception 'Recurrence end requires a frequency at ordinal %.', v_ordinal using errcode='22023';
    end if;
    if v_recurrence_ends_on is not null and v_recurrence_ends_on < v_due_date then
      raise exception 'Recurrence end precedes due date at ordinal %.', v_ordinal using errcode='22023';
    end if;
  end loop;

  v_request_hash := md5(jsonb_build_object(
    'actor_id', p_actor_id::text,
    'batch_id', p_batch_id::text,
    'department_id', p_department_id::text,
    'assignee_id', p_assignee_id::text,
    'tasks', p_tasks
  )::text);

  -- Serialize retries for the same actor/batch before checking/inserting the
  -- unique idempotency key. A failed transaction rolls this lock's writes back.
  perform pg_advisory_xact_lock(hashtextextended(p_actor_id::text || ':' || p_batch_id::text, 0));
  select * into v_existing
  from public.task_assignment_batch_idempotency
  where actor_id = p_actor_id and batch_id = p_batch_id
  for update;

  if found then
    if v_existing.request_hash <> v_request_hash then
      raise exception 'batch_id_conflict' using errcode='23505';
    end if;
    if v_existing.completed_at is null then
      raise exception 'batch_id_incomplete' using errcode='40001';
    end if;
    return jsonb_build_object(
      'batchId', p_batch_id,
      'task_ids', to_jsonb(v_existing.task_ids),
      'tasks', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'ordinal', row_number,
          'id', task_id,
          'title', task.title
        ) order by row_number), '[]'::jsonb)
        from unnest(v_existing.task_ids) with ordinality as rows(task_id, row_number)
        join public.tasks task on task.id = task_id
      ),
      'count', v_existing.task_count,
      'replayed', true
    );
  end if;

  insert into public.task_assignment_batch_idempotency(
    actor_id, batch_id, request_hash, task_ids, task_count
  ) values (
    p_actor_id, p_batch_id, v_request_hash, '{}'::uuid[], v_count
  );

  for v_item, v_ordinal in
    select value, ordinality
    from jsonb_array_elements(p_tasks) with ordinality
  loop
    v_collaborator_ids := coalesce(
      array(select value::uuid from jsonb_array_elements_text(coalesce(v_item->'collaborator_ids', '[]'::jsonb))),
      '{}'::uuid[]
    );
    v_watcher_ids := coalesce(
      array(select value::uuid from jsonb_array_elements_text(coalesce(v_item->'watcher_ids', '[]'::jsonb))),
      '{}'::uuid[]
    );
    v_recurrence_frequency := nullif(v_item->>'recurrence_frequency', '');
    v_recurrence_ends_on := nullif(v_item->>'recurrence_ends_on', '')::date;
    v_task := public.api_assign_task_v2(
      p_actor_id,
      v_item->>'title',
      v_item->>'description',
      p_department_id,
      p_assignee_id,
      p_actor_id,
      (v_item->>'due_date')::date,
      (v_item->>'due_time')::time,
      nullif(v_item->>'evaluation_criteria', ''),
      v_collaborator_ids,
      v_watcher_ids,
      v_recurrence_frequency,
      v_recurrence_ends_on,
      coalesce(nullif(v_item->>'priority', ''), 'normal')
    );
    v_task_ids := array_append(v_task_ids, v_task.id);
    v_task_results := v_task_results || jsonb_build_array(jsonb_build_object(
      'ordinal', v_ordinal,
      'id', v_task.id,
      'title', v_task.title
    ));
  end loop;

  update public.task_assignment_batch_idempotency
  set task_ids = v_task_ids,
      completed_at = clock_timestamp()
  where actor_id = p_actor_id and batch_id = p_batch_id;

  return jsonb_build_object(
    'batchId', p_batch_id,
    'task_ids', to_jsonb(v_task_ids),
    'tasks', v_task_results,
    'count', v_count,
    'replayed', false
  );
end
$function$;

revoke all on function public.api_assign_task_batch_v1(uuid,uuid,uuid,uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.api_assign_task_batch_v1(uuid,uuid,uuid,uuid,jsonb)
  to service_role;
alter function public.api_assign_task_batch_v1(uuid,uuid,uuid,uuid,jsonb)
  owner to postgres;

create or replace function public.api_register_journalism_task_v1(
  p_actor_id uuid,
  p_title text,
  p_description text,
  p_department_id uuid,
  p_due_date date,
  p_due_time time,
  p_evaluation_criteria text,
  p_work_kind_id uuid,
  p_planned_publication_at timestamptz,
  p_location text,
  p_editorial_notes text
) returns public.tasks
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_task public.tasks;
  v_actor_role text;
  v_actor_department uuid;
  v_manager uuid;
  v_kind public.journalism_work_kinds;
begin
  p_due_time := case when p_due_date is null then null else coalesce(p_due_time,time '17:00') end;
  select r.code, u.department_id into v_actor_role, v_actor_department
  from public.staff_users u
  join public.roles r on r.id=u.role_id and r.active=true
  join public.departments d on d.id=u.department_id and d.active=true
  where u.id=p_actor_id and u.active=true;
  if v_actor_role is null or v_actor_department is null then
    raise exception 'Invalid actor.' using errcode='42501';
  end if;
  if v_actor_department <> p_department_id then
    raise exception 'Journalism target must be Content department.' using errcode='42501';
  end if;
  if not exists(select 1 from public.departments where id=p_department_id and code='editorial' and active=true) then
    raise exception 'Journalism target must be Content department.' using errcode='42501';
  end if;
  if v_actor_role not in ('phong_vien','nhan_vien','bien_tap_vien') then
    raise exception 'Self-registration is limited to editorial employees.' using errcode='42501';
  end if;
  select manager_id into v_manager from public.departments where id=p_department_id and active=true;
  if v_manager is null then
    raise exception 'Department requires a primary manager.' using errcode='22023';
  end if;
  if nullif(btrim(p_title),'') is null or length(p_title)>500
     or nullif(btrim(p_description),'') is null or length(p_description)>10000
     or (p_evaluation_criteria is not null and length(p_evaluation_criteria)>10000)
     or (p_location is not null and length(p_location)>500)
     or (p_editorial_notes is not null and length(p_editorial_notes)>10000)
     or (p_planned_publication_at is not null and p_planned_publication_at < now()) then
    raise exception 'Invalid journalism task input.' using errcode='22023';
  end if;
  select * into v_kind from public.journalism_work_kinds where id=p_work_kind_id and is_active=true;
  if not found then raise exception 'Inactive work kind.' using errcode='22023'; end if;

  insert into public.tasks(
    title,description,department_id,assignee_id,owner_id,reviewer_id,created_by,
    assignment_mode,due_date,due_time,status,progress_percent,plan_period,self_claimable,
    task_type,start_date,evaluation_criteria,priority,approval_required
  ) values(
    btrim(p_title),btrim(p_description),p_department_id,p_actor_id,p_actor_id,v_manager,p_actor_id,
    'individual',p_due_date,p_due_time,'waiting',0,'ad_hoc',false,'assigned',
    timezone('Asia/Ho_Chi_Minh',now())::date,nullif(btrim(p_evaluation_criteria),''),'normal',true
  ) returning * into v_task;
  insert into public.task_assignees(task_id,user_id,assignment_role,status)
  values(v_task.id,p_actor_id,'owner','todo');
  insert into public.journalism_task_details(
    task_id,work_kind_id,publication_status,planned_publication_at,location,editorial_notes
  ) values(
    v_task.id,p_work_kind_id,'not_published',p_planned_publication_at,
    nullif(btrim(p_location),''),nullif(btrim(p_editorial_notes),'')
  );
  insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id)
  values(v_task.id,null,'waiting','Chờ duyệt giao việc',p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor_id,'task','tasks',v_task.id,'create',jsonb_build_object(
    'task_type','assigned','status','waiting','approval_required',true,'assignment_source','self_registered'
  ));
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor_id,'task','tasks',v_task.id,'submit_assignment_approval',jsonb_build_object(
    'status','waiting','approval_required',true,'reviewer_id',v_manager
  ));
  return v_task;
end
$function$;

revoke all on function public.api_register_journalism_task_v1(uuid,text,text,uuid,date,time,text,uuid,timestamptz,text,text)
  from public,anon,authenticated;
grant execute on function public.api_register_journalism_task_v1(uuid,text,text,uuid,date,time,text,uuid,timestamptz,text,text)
  to service_role;
alter function public.api_register_journalism_task_v1(uuid,text,text,uuid,date,time,text,uuid,timestamptz,text,text)
  owner to postgres;

create or replace function public.api_change_assigned_task_deadline(p_actor_id uuid,p_task_id uuid,p_new_due_date date,p_reason text)
returns public.tasks language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_before public.tasks; v_after public.tasks; v_admin boolean;
begin
  select * into v_before from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
  if v_before.project_id is not null then
    select exists(select 1 from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor_id and u.active and r.active and r.code='admin') into v_admin;
    if v_before.status='cancelled' or (not v_admin and (v_before.status='done' or not public.api_project_is_lead(p_actor_id,v_before.project_id))) then
      raise exception 'Project deadline change forbidden.' using errcode='42501';
    end if;
  else
    v_before := public.api_assert_task_creator_mutation(p_actor_id,p_task_id,'edit');
  end if;
  if v_before.task_type is distinct from 'assigned' or p_new_due_date is null or p_new_due_date<v_before.start_date or p_new_due_date is not distinct from v_before.due_date or nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then raise exception 'Invalid assigned deadline change.' using errcode='22023'; end if;
  update public.tasks set due_date=p_new_due_date,due_time=coalesce(due_time,time '17:00'),updated_at=now() where id=p_task_id returning * into v_after;
  insert into public.task_deadline_history(task_id,old_due_date,new_due_date,reason,changed_by) values(p_task_id,v_before.due_date,p_new_due_date,btrim(p_reason),p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values(p_actor_id,'task','tasks',p_task_id,'deadline_change',jsonb_build_object('due_date',v_before.due_date),jsonb_build_object('due_date',p_new_due_date,'reason',btrim(p_reason)));
  return v_after;
end
$function$;

revoke all on function public.api_change_assigned_task_deadline(uuid,uuid,date,text) from public,anon,authenticated;
grant execute on function public.api_change_assigned_task_deadline(uuid,uuid,date,text) to service_role;

create or replace function public.api_assign_project_task(p_actor_id uuid,p_project_id uuid,p_title text,p_description text,p_assignee_id uuid,p_reviewer_id uuid,p_due_date date,p_due_time time,p_evaluation_criteria text default null,p_collaborator_ids uuid[] default '{}'::uuid[],p_watcher_ids uuid[] default '{}'::uuid[],p_priority text default 'normal',p_attachment_url text default null) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp as $function$
declare v public.tasks; x uuid; v_host uuid; v_status text;
begin
 p_due_time := case when p_due_date is null then null else coalesce(p_due_time,time '17:00') end;
 select status,host_department_id into v_status,v_host from public.projects where id=p_project_id for update;
 if not found or v_status<>'active' then raise exception 'Project is closed or missing.' using errcode='42501'; end if;
 if not public.api_project_can_assign(p_actor_id,p_project_id) then raise exception 'Only project leads and deputies may assign.' using errcode='42501'; end if;
 p_reviewer_id := coalesce(p_reviewer_id,case when public.api_project_is_lead(p_actor_id,p_project_id) then p_actor_id else (select m.user_id from public.project_members m join public.staff_users u on u.id=m.user_id where m.project_id=p_project_id and m.role='lead' and u.active order by m.added_at,m.user_id limit 1) end);
 if nullif(btrim(p_title),'') is null or nullif(btrim(p_description),'') is null or length(p_title)>500 or length(p_description)>10000 or length(p_evaluation_criteria)>10000 or length(p_attachment_url)>2048 or p_priority is null or p_priority not in ('low','normal','high','urgent') then raise exception 'Invalid assignment input.' using errcode='22023'; end if;
 if not exists(select 1 from public.project_members m join public.staff_users u on u.id=m.user_id where m.project_id=p_project_id and m.user_id=p_assignee_id and u.active) then raise exception 'Assignee must be an active project member.' using errcode='22023'; end if;
 if not (exists(select 1 from public.project_members m join public.staff_users u on u.id=m.user_id where m.project_id=p_project_id and m.user_id=p_reviewer_id and m.role='lead' and u.active) or (p_reviewer_id=p_actor_id and exists(select 1 from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor_id and u.active and r.code='admin'))) then raise exception 'Reviewer must be a project lead.' using errcode='22023'; end if;
 if exists(select 1 from unnest(coalesce(p_collaborator_ids,'{}') || coalesce(p_watcher_ids,'{}')) candidate(id) where not exists(select 1 from public.project_members m join public.staff_users u on u.id=m.user_id where m.project_id=p_project_id and m.user_id=candidate.id and u.active)) then raise exception 'All project participants must be active members.' using errcode='22023'; end if;
 insert into public.tasks(title,description,project_id,department_id,assignee_id,owner_id,reviewer_id,created_by,assignment_mode,due_date,due_time,status,progress_percent,plan_period,self_claimable,task_type,priority,attachment_url,evaluation_criteria,start_date) values(btrim(p_title),btrim(p_description),p_project_id,v_host,p_assignee_id,p_assignee_id,p_reviewer_id,p_actor_id,case when cardinality(coalesce(p_collaborator_ids,'{}'))>0 then 'multi_user' else 'individual' end,p_due_date,p_due_time,'new',0,'ad_hoc',false,'assigned',p_priority,p_attachment_url,nullif(btrim(p_evaluation_criteria),''),timezone('Asia/Ho_Chi_Minh',now())::date) returning * into v;
 insert into public.task_assignees(task_id,user_id,assignment_role,status) values(v.id,p_assignee_id,'owner','todo');
 foreach x in array coalesce(p_collaborator_ids,'{}') loop if x<>p_assignee_id then insert into public.task_assignees(task_id,user_id,assignment_role,status) values(v.id,x,'assignee','todo') on conflict do nothing; end if; end loop;
 foreach x in array coalesce(p_watcher_ids,'{}') loop if x<>p_assignee_id and not (x=any(coalesce(p_collaborator_ids,'{}'))) then insert into public.task_assignees(task_id,user_id,assignment_role,status) values(v.id,x,'watcher','todo') on conflict do nothing; end if; end loop;
 insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor_id,'project','tasks',v.id,'assign',jsonb_build_object('project_id',p_project_id)); return v;
end $function$;
revoke all on function public.api_assign_project_task(uuid,uuid,text,text,uuid,uuid,date,time,text,uuid[],uuid[],text,text) from public,anon,authenticated;
grant execute on function public.api_assign_project_task(uuid,uuid,text,text,uuid,uuid,date,time,text,uuid[],uuid[],text,text) to service_role;
alter function public.api_assign_project_task(uuid,uuid,text,text,uuid,uuid,date,time,text,uuid[],uuid[],text,text) owner to postgres;

notify pgrst,'reload schema';
commit;

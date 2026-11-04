begin;

alter table public.tasks add column if not exists entered_by uuid references public.staff_users(id);

drop function if exists public.api_assign_task_batch_v1(uuid,uuid,uuid,uuid,jsonb);
drop function if exists public.api_assign_task_v2(uuid,text,text,uuid,uuid,uuid,date,time,text,uuid[],uuid[],text,date,text);

create or replace function public.api_assign_task_v2(
  p_actor_id uuid,p_title text,p_description text,p_department_id uuid,
  p_assignee_id uuid,p_reviewer_id uuid,p_due_date date,p_due_time time,
  p_evaluation_criteria text default null,
  p_collaborator_ids uuid[] default '{}'::uuid[],
  p_watcher_ids uuid[] default '{}'::uuid[],
  p_recurrence_frequency text default null,
  p_recurrence_ends_on date default null,
  p_priority text default 'normal',
  p_on_behalf_of uuid default null
) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_assigner_id uuid := coalesce(p_on_behalf_of,p_actor_id);
  v_caller_role text;
  v_task public.tasks;
  v_rule public.task_recurrence_rules;
  v_actor_role text;
  v_actor_department uuid;
  v_manager uuid;
  v_user uuid;
  v_month_end boolean;
begin
  p_due_time := case when p_due_date is null then null else coalesce(p_due_time,time '17:00') end;
  if p_on_behalf_of is not null then
    select r.code into v_caller_role from public.staff_users u
      join public.roles r on r.id=u.role_id and r.active=true
      where u.id=p_actor_id and u.active=true;
    if v_caller_role is distinct from 'admin' then
      raise exception 'Only admin may enter assignments on behalf of another user.' using errcode='42501';
    end if;
    if not exists (
      select 1 from public.staff_users u
      join public.roles r on r.id=u.role_id and r.active=true
      left join public.job_titles jt on jt.id=u.job_title_id and jt.active=true
      where u.id=v_assigner_id and u.active=true and r.code<>'admin'
        and (r.code in ('tong_bien_tap','pho_tong_bien_tap','truong_phong','pho_truong_phong',
                        'phu_trach_phong_bien_tap','phu_trach_phong_phong_vien','phu_trach_phong_tri_su')
             or jt.code in ('truong_phong','pho_truong_phong')
             or exists(select 1 from public.departments d where d.manager_id=u.id and d.active=true))
    ) then raise exception 'Invalid leadership assigner.' using errcode='42501'; end if;
    p_reviewer_id := v_assigner_id;
  end if;
  -- Keep the existing authorization and recipient scope, evaluated as the leader.
  perform public.api_assert_task_action(v_assigner_id,null,'assign');
  select r.code,u.department_id into v_actor_role,v_actor_department
  from public.staff_users u join public.roles r on r.id=u.role_id
  where u.id=v_assigner_id and u.active=true;
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
    title,description,department_id,assignee_id,owner_id,reviewer_id,created_by,entered_by,
    assignment_mode,due_date,due_time,status,progress_percent,plan_period,self_claimable,
    task_type,start_date,evaluation_criteria,priority
  ) values(
    btrim(p_title),btrim(p_description),p_department_id,p_assignee_id,p_assignee_id,
    p_reviewer_id,v_assigner_id,case when p_on_behalf_of is not null then p_actor_id end,
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
      ),p_due_time,v_assigner_id,p_priority
    ) returning * into v_rule;
    update public.tasks set recurrence_rule_id=v_rule.id where id=v_task.id returning * into v_task;
    insert into public.task_recurrence_occurrences(rule_id,scheduled_for,task_id)
    values(v_rule.id,p_due_date,v_task.id);
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
    values(p_actor_id,'task','task_recurrence_rules',v_rule.id,'create',jsonb_build_object('frequency',p_recurrence_frequency,'first_due_date',p_due_date,'due_time',p_due_time));
  end if;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor_id,'task','tasks',v_task.id,'create',jsonb_build_object('task_type','assigned','manager_watcher_id',v_manager,'recurring',p_recurrence_frequency is not null,'due_time',p_due_time,'entered_by',v_task.entered_by,'assigner_id',v_assigner_id));
  return v_task;
end
$function$;

revoke all on function public.api_assign_task_v2(uuid,text,text,uuid,uuid,uuid,date,time,text,uuid[],uuid[],text,date,text,uuid) from public,anon,authenticated;
grant execute on function public.api_assign_task_v2(uuid,text,text,uuid,uuid,uuid,date,time,text,uuid[],uuid[],text,date,text,uuid) to service_role;
alter function public.api_assign_task_v2(uuid,text,text,uuid,uuid,uuid,date,time,text,uuid[],uuid[],text,date,text,uuid) owner to postgres;

create or replace function public.api_assign_task_batch_v1(
  p_actor_id uuid,
  p_batch_id uuid,
  p_department_id uuid,
  p_assignee_id uuid,
  p_tasks jsonb,
  p_on_behalf_of uuid default null
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_caller_role text;
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
  if p_on_behalf_of is not null then
    select r.code into v_caller_role from public.staff_users u
      join public.roles r on r.id=u.role_id and r.active=true where u.id=p_actor_id and u.active=true;
    if v_caller_role is distinct from 'admin' then
      raise exception 'Only admin may enter assignments on behalf of another user.' using errcode='42501';
    end if;
    perform public.api_assert_task_action(p_on_behalf_of,null,'assign');
  end if;
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

  v_request_hash := md5((jsonb_build_object(
    'actor_id', p_actor_id::text,
    'batch_id', p_batch_id::text,
    'department_id', p_department_id::text,
    'assignee_id', p_assignee_id::text,
    'tasks', p_tasks
  ) || case when p_on_behalf_of is null then '{}'::jsonb else jsonb_build_object('on_behalf_of',p_on_behalf_of) end)::text);

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
      coalesce(nullif(v_item->>'priority', ''), 'normal'),
      p_on_behalf_of
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

revoke all on function public.api_assign_task_batch_v1(uuid,uuid,uuid,uuid,jsonb,uuid)
  from public,anon,authenticated;
grant execute on function public.api_assign_task_batch_v1(uuid,uuid,uuid,uuid,jsonb,uuid)
  to service_role;
alter function public.api_assign_task_batch_v1(uuid,uuid,uuid,uuid,jsonb,uuid)
  owner to postgres;

notify pgrst,'reload schema';
commit;

-- Verbatim pre-images for 20261029090000_business_rule_errcode_55000.sql.
-- Source: live inventory captured 2026-10-28 at 05:43 UTC.

CREATE OR REPLACE FUNCTION public.api_asset_status_request_review(p_actor_id uuid, p_request_id uuid, p_decision text, p_review_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_request public.asset_status_change_requests%rowtype; v_old_request jsonb; v_asset public.assets%rowtype; v_assignment public.asset_assignments%rowtype; v_new_condition text; v_old_condition text;
begin
  if not public.asset_actor_can_manage(p_actor_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_decision not in ('approve', 'reject') then raise exception 'invalid_decision' using errcode = '22023'; end if;
  select * into v_request from public.asset_status_change_requests where id = p_request_id for update;
  if not found then raise exception 'request_not_found' using errcode = 'P0002'; end if;
  if v_request.status <> 'pending' then raise exception 'request_already_reviewed' using errcode = 'P0001'; end if;
  v_old_request := to_jsonb(v_request);
  if p_decision = 'approve' then
    select * into v_asset from public.assets where id = v_request.asset_id for update;
    select * into v_assignment from public.asset_assignments where id = v_request.expected_assignment_id and asset_id = v_request.asset_id and assignee_id = v_request.requester_id and status = 'active' and returned_at is null for update;
    if not found or v_asset.status is distinct from v_request.expected_current_status or v_asset.condition_status is distinct from v_request.expected_condition_status then raise exception 'asset_condition_or_assignment_conflict' using errcode = '40001'; end if;
    v_old_condition := v_asset.condition_status;
    v_new_condition := case v_request.requested_status when 'maintenance' then 'needs_maintenance' else 'broken' end;
    update public.assets set condition_status = v_new_condition, updated_at = now() where id = v_asset.id returning * into v_asset;
  end if;
  update public.asset_status_change_requests set status = case when p_decision = 'approve' then 'approved' else 'rejected' end, reviewed_by = p_actor_id, reviewed_at = now(), review_note = nullif(btrim(p_review_note), ''), updated_at = now() where id = v_request.id returning * into v_request;
  insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, old_data, new_data) values (p_actor_id, 'assets', 'asset_status_change_requests', v_request.id, case when p_decision = 'approve' then 'condition_change_approved' else 'condition_change_rejected' end, jsonb_build_object('request', v_old_request, 'condition_status', v_old_condition, 'expected_assignment_id', v_request.expected_assignment_id), jsonb_build_object('request', to_jsonb(v_request), 'condition_status', v_new_condition, 'reviewer', p_actor_id, 'reviewed_at', v_request.reviewed_at));
  return jsonb_build_object('request', to_jsonb(v_request), 'asset', case when p_decision = 'approve' then to_jsonb(v_asset) else null end);
end;
$function$;
CREATE OR REPLACE FUNCTION public.api_assign_task_batch_v1(p_actor_id uuid, p_batch_id uuid, p_department_id uuid, p_assignee_id uuid, p_tasks jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
       or nullif(v_item->>'due_date', '') is null
       or nullif(v_item->>'due_time', '') is null then
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
CREATE OR REPLACE FUNCTION public.api_cancel_leave_request(p_actor uuid, p_request_id uuid)
 RETURNS leave_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_row public.leave_requests; v_old public.leave_requests; v_role text; v_state text;
begin
  select r.code into v_role from public.staff_users u join public.roles r on r.id=u.role_id
    where u.id=p_actor and u.active=true and r.active=true;
  select * into v_old from public.leave_requests where id=p_request_id for update;
  if not found then raise exception 'leave request unavailable' using errcode='40001'; end if;
  v_state := case v_old.status when 'approved' then 'APPROVED' when 'cancelled' then 'CANCELLED' else 'PENDING' end;
  perform public.api_assert_creator_mutation(p_actor,v_old.requester_id,v_state,'cancel');
  update public.leave_requests set status='cancelled',updated_at=now() where id=p_request_id returning * into v_row;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor,'admin','leave_requests',v_row.id,'cancel_leave_request',to_jsonb(v_old),to_jsonb(v_row));
  return v_row;
end $function$;
CREATE OR REPLACE FUNCTION public.api_cancel_personal_work_schedule(p_actor uuid, p_id uuid, p_expected_revision bigint)
 RETURNS work_schedules
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_old public.work_schedules; v_row public.work_schedules; v_role text;
begin
  select r.code into v_role from public.staff_users u join public.roles r on r.id=u.role_id
    where u.id=p_actor and u.active=true and r.active=true;
  select * into v_old from public.work_schedules where id=p_id for update;
  if not found or v_old.schedule_scope is distinct from 'personal' then raise exception 'personal plan unavailable' using errcode='P0002'; end if;
  if p_expected_revision is null or p_expected_revision<>v_old.workflow_revision then raise exception 'stale personal plan' using errcode='40001'; end if;
  perform public.api_assert_creator_mutation(
    p_actor,v_old.created_by,
    case v_old.approval_status when 'APPROVED' then 'APPROVED' when 'CANCELLED' then 'CANCELLED' else 'PENDING' end,
    'cancel');
  update public.work_schedules set approval_status='CANCELLED',
    workflow_revision=workflow_revision+1,updated_at=now() where id=p_id returning * into v_row;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor,'admin','work_schedules',v_row.id,'cancel_personal_plan',to_jsonb(v_old),to_jsonb(v_row));
  return v_row;
end $function$;
CREATE OR REPLACE FUNCTION public.api_create_personal_work_schedule(p_actor uuid, p_id uuid, p_work_date date, p_end_date date, p_plan_type text, p_start_time time without time zone, p_end_time time without time zone, p_title text, p_location text, p_notes text, p_participant_ids uuid[], p_expected_revision bigint DEFAULT NULL::bigint)
 RETURNS work_schedules
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_row public.work_schedules;
  v_old public.work_schedules;
  v_department uuid;
  v_manager uuid;
  v_role text;
  v_material boolean;
  v_scope text;
  v_status text;
  v_action text;
  v_revision bigint;
  v_owner uuid;
begin
  select u.department_id, lower(r.code)
  into v_department, v_role
  from public.staff_users u
  join public.roles r on r.id=u.role_id
  where u.id=p_actor and u.active=true;
  if not found then
    raise exception 'forbidden' using errcode='42501';
  end if;

  if p_work_date is null or p_end_date is null or p_end_date < p_work_date
     or p_plan_type not in ('work','business','event')
     or p_start_time is null or p_end_time is null
     or (p_work_date = p_end_date and p_end_time <= p_start_time)
     or length(trim(coalesce(p_title,''))) not between 1 and 500
     or coalesce(array_length(p_participant_ids, 1), 0) > 50 then
    raise exception 'invalid personal plan' using errcode='22023';
  end if;

  select d.manager_id into v_manager
  from public.departments d
  left join public.staff_users manager on manager.id=d.manager_id and manager.active=true
  where d.id=v_department and d.active=true;
  if v_manager is not null and not exists (select 1 from public.staff_users where id=v_manager and active=true) then
    v_manager := null;
  end if;

  if p_id is null then
    if p_participant_ids is distinct from array[p_actor]::uuid[] then
      raise exception 'personal plans may only include the creator' using errcode='42501';
    end if;
    insert into public.work_schedules(
      work_date,end_date,plan_type,start_time,end_time,title,location,notes,
      participant_ids,created_by,schedule_scope,approval_status,approver_id,
      submitted_at,workflow_revision,updated_at
    ) values (
      p_work_date,p_end_date,p_plan_type,p_start_time,p_end_time,trim(p_title),
      nullif(trim(p_location),''),nullif(trim(p_notes),''),
      array[p_actor]::uuid[],p_actor,'personal','PENDING_APPROVAL',
      v_manager,now(),1,now()
    ) returning * into v_row;
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
    values(p_actor,'admin','work_schedules',v_row.id,'create_personal_plan',to_jsonb(v_row));
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
    values(p_actor,'admin','work_schedules',v_row.id,'submit_personal_plan',to_jsonb(v_row));
    return v_row;
  end if;

  select * into v_old
  from public.work_schedules
  where id=p_id
  for update;
  if not found then
    raise exception 'personal plan unavailable' using errcode='P0002';
  end if;
  if v_old.created_by <> p_actor and v_role <> 'admin' then
    raise exception 'forbidden' using errcode='42501';
  end if;
  v_owner := v_old.created_by;
  select department_id into v_department
  from public.staff_users
  where id=v_owner and active=true;
  select d.manager_id into v_manager
  from public.departments d
  left join public.staff_users manager on manager.id=d.manager_id and manager.active=true
  where d.id=v_department and d.active=true;
  if v_old.schedule_scope = 'organization' then
    raise exception 'forbidden' using errcode='42501';
  end if;
  perform public.api_assert_creator_mutation(
    p_actor,
    v_old.created_by,
    case v_old.approval_status when 'APPROVED' then 'APPROVED' when 'CANCELLED' then 'CANCELLED' else 'PENDING' end,
    'edit'
  );
  if p_expected_revision is null or p_expected_revision <> v_old.workflow_revision then
    raise exception 'stale personal plan' using errcode='40001';
  end if;

  v_material := v_old.work_date is distinct from p_work_date
    or v_old.end_date is distinct from p_end_date
    or v_old.plan_type is distinct from p_plan_type
    or v_old.start_time is distinct from p_start_time
    or v_old.end_time is distinct from p_end_time
    or v_old.title is distinct from trim(p_title)
    or v_old.location is distinct from nullif(trim(p_location),'')
    or v_old.notes is distinct from nullif(trim(p_notes),'')
    or v_old.participant_ids is distinct from array[v_owner]::uuid[];

  v_scope := 'personal';
  v_status := v_old.approval_status;
  v_action := 'edit_personal_plan';
  if v_material and v_old.approval_status = 'REJECTED' then
    v_status := 'PENDING_APPROVAL';
    v_action := case when v_old.schedule_scope is null then 'promote_legacy_personal_plan' else 'submit_personal_plan' end;
  elsif v_old.schedule_scope is null then
    v_action := 'promote_legacy_personal_plan';
  end if;
  v_revision := v_old.workflow_revision + 1;

  update public.work_schedules
  set work_date=p_work_date,end_date=p_end_date,plan_type=p_plan_type,
      start_time=p_start_time,end_time=p_end_time,title=trim(p_title),
      location=nullif(trim(p_location),''),notes=nullif(trim(p_notes),''),
      participant_ids=array[v_owner]::uuid[],schedule_scope=v_scope,
      approval_status=v_status,
      approver_id=case when v_status='PENDING_APPROVAL' then v_manager else v_old.approver_id end,
      submitted_at=case when v_status='PENDING_APPROVAL' then now() else v_old.submitted_at end,
      reviewed_by=case when v_status='PENDING_APPROVAL' then null else v_old.reviewed_by end,
      reviewed_at=case when v_status='PENDING_APPROVAL' then null else v_old.reviewed_at end,
      review_note=case when v_status='PENDING_APPROVAL' then null else v_old.review_note end,
      workflow_revision=v_revision,updated_at=now()
  where id=p_id
  returning * into v_row;

  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor,'admin','work_schedules',v_row.id,v_action,to_jsonb(v_old),to_jsonb(v_row));
  return v_row;
end $function$;
CREATE OR REPLACE FUNCTION public.api_create_quick_report_v1_legacy(p_actor_id uuid, p_request_id uuid, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor public.staff_users;
  v_hash text;
  v_existing public.task_quick_report_idempotency;
  v_row record;
  v_task public.tasks;
  v_ids uuid[] := '{}'::uuid[];
  v_tasks jsonb := '[]'::jsonb;
  v_count integer;
  v_index integer := 0;
  v_replayed boolean := false;
  v_completed_at timestamptz;
  v_started timestamptz;
  v_completed timestamptz;
  v_completed_date date;
begin
  if p_actor_id is null or p_request_id is null or jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 50 then
    raise exception 'Invalid quick report batch.' using errcode='22023';
  end if;

  select * into v_actor from public.staff_users where id = p_actor_id and active = true;
  if not found then raise exception 'Invalid quick report actor.' using errcode='42501'; end if;
  if not exists (
    select 1 from public.staff_users u
    join public.roles r on r.id = u.role_id and r.active = true
    join public.role_permission_grants g on g.role_id = r.id and g.scope in ('self', 'all')
    join public.permissions p on p.id = g.permission_id and p.code = 'task.quick_report.create'
    where u.id = p_actor_id and u.active = true
    union all
    select 1 from public.staff_users u
    join public.user_permission_grants g on g.user_id = u.id and g.scope in ('self', 'all')
    join public.permissions p on p.id = g.permission_id and p.code = 'task.quick_report.create'
    where u.id = p_actor_id and u.active = true
  ) then
    raise exception 'Quick report permission denied.' using errcode='42501';
  end if;

  v_count := jsonb_array_length(p_rows);
  v_hash := md5(p_rows::text);
  select * into v_existing
  from public.task_quick_report_idempotency
  where actor_id = p_actor_id and request_id = p_request_id
  for update;
  if found then
    if v_existing.request_hash <> v_hash then
      raise exception 'Quick report request id reused with different payload.' using errcode='23505';
    end if;
    if v_existing.completed_at is not null then
      v_replayed := true;
      select coalesce(jsonb_agg(jsonb_build_object('ordinal', x.ordinal, 'id', x.id, 'title', t.title) order by x.ordinal), '[]'::jsonb)
      into v_tasks
      from unnest(v_existing.task_ids) with ordinality as x(id, ordinal)
      join public.tasks t on t.id = x.id;
      return jsonb_build_object('batchId', p_request_id, 'tasks', v_tasks, 'count', v_existing.task_count, 'replayed', true);
    end if;
    raise exception 'Quick report request is already in progress.' using errcode='40001';
  end if;

  insert into public.task_quick_report_idempotency(actor_id, request_id, request_hash, task_count)
  values (p_actor_id, p_request_id, v_hash, v_count);

  for v_row in
    select * from jsonb_to_recordset(p_rows) as x(
      title text, category text, work_date date, completed_date date,
      started_time text, completed_time text, status text, notes text
    )
  loop
    v_index := v_index + 1;
    v_completed_date := coalesce(v_row.completed_date, v_row.work_date);
    if nullif(btrim(v_row.title), '') is null or length(v_row.title) > 500
       or v_row.category not in ('computer', 'network', 'printer_device', 'facilities', 'official_document', 'administration', 'other')
       or v_row.work_date is null
       or v_row.started_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or v_row.status not in ('in_progress', 'done')
       or (v_row.status = 'in_progress' and (v_row.completed_date is not null or nullif(v_row.completed_time, '') is not null))
       or (v_row.status = 'done' and v_completed_date is null)
       or (v_completed_date is not null and v_completed_date < v_row.work_date)
       or (v_row.completed_time is not null and v_row.completed_time <> '' and v_row.completed_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
       or (v_row.status = 'done' and nullif(v_row.completed_time, '') is null)
       or length(coalesce(v_row.notes, '')) > 10000 then
      raise exception 'Invalid quick report row %.', v_index using errcode='22023';
    end if;

    v_started := (v_row.work_date + v_row.started_time::time) at time zone 'Asia/Ho_Chi_Minh';
    v_completed := case when v_row.status = 'done' then (v_completed_date + v_row.completed_time::time) at time zone 'Asia/Ho_Chi_Minh' else null end;
    insert into public.tasks(
      title, description, status, progress_percent, assignee_id, owner_id, reviewer_id,
      assignment_mode, created_by, department_id, due_date, due_time, plan_period, self_claimable,
      task_type, start_date, approval_required, workflow_type, report_category, report_work_date,
      report_started_time, report_completed_time, report_notes, completed_at, completion_submitted_at
    ) values (
      btrim(v_row.title), nullif(btrim(v_row.notes), ''), v_row.status,
      case when v_row.status = 'done' then 100 else 0 end, p_actor_id, p_actor_id, null,
      'individual', p_actor_id, v_actor.department_id, v_row.work_date,
      coalesce(nullif(v_row.completed_time, '')::time, v_row.started_time::time), 'ad_hoc', false,
      'personal', v_row.work_date, false, 'REPORT_ONLY', v_row.category, v_row.work_date,
      v_row.started_time::time, nullif(v_row.completed_time, '')::time, nullif(btrim(v_row.notes), ''),
      v_completed, v_completed
    ) returning * into v_task;
    insert into public.task_assignees(task_id, user_id, assignment_role, status)
    values (v_task.id, p_actor_id, 'owner', case when v_row.status = 'done' then 'done' else 'in_progress' end);
    insert into public.task_status_events(task_id, from_status, to_status, reason, actor_id)
    values (v_task.id, null, v_row.status, 'REPORT_ONLY', p_actor_id);
    insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data)
    values (p_actor_id, 'task', 'tasks', v_task.id, 'create_quick_report', jsonb_build_object(
      'workflow_type', 'REPORT_ONLY', 'report_category', v_row.category,
      'report_work_date', v_row.work_date, 'report_completed_date', case when v_row.status = 'done' then v_completed_date else null end,
      'report_started_time', v_row.started_time, 'report_completed_time', nullif(v_row.completed_time, ''),
      'status', v_row.status, 'owner_id', p_actor_id, 'assignee_id', p_actor_id
    ));
    v_ids := array_append(v_ids, v_task.id);
    v_tasks := v_tasks || jsonb_build_array(jsonb_build_object('ordinal', v_index, 'id', v_task.id, 'title', v_task.title));
  end loop;

  v_completed_at := now();
  update public.task_quick_report_idempotency
  set task_ids = v_ids, completed_at = v_completed_at
  where actor_id = p_actor_id and request_id = p_request_id;
  return jsonb_build_object('batchId', p_request_id, 'tasks', v_tasks, 'count', v_count, 'replayed', v_replayed);
end
$function$;
CREATE OR REPLACE FUNCTION public.api_department_plan_assign_core(p_actor_id uuid, p_item_id uuid, p_input jsonb)
 RETURNS tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_item public.department_plan_items;
  v_plan public.department_plans;
  v_task public.tasks;
  v_actor_role text;
  v_actor_department uuid;
  v_manager uuid;
  v_title text;
  v_description text;
  v_note text;
  v_requirements_text text;
  v_requirements jsonb;
  v_assignee_values jsonb;
  v_collaborator_values jsonb;
  v_watcher_values jsonb;
  v_assignee_ids uuid[] := '{}'::uuid[];
  v_additional_ids uuid[] := '{}'::uuid[];
  v_watcher_ids uuid[] := '{}'::uuid[];
  v_user uuid;
  v_entry jsonb;
  v_value text;
  v_due_date date;
  v_due_time time;
  v_priority text;
  v_work_status text;
begin
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'Invalid Department Plan assignment input.' using errcode = '22023';
  end if;

  perform public.api_assert_task_action(p_actor_id, null, 'assign');

  select * into v_item
    from public.department_plan_items
   where id = p_item_id
   for update;
  if not found then
    raise exception 'Department plan item not found.' using errcode = 'P0002';
  end if;

  select * into v_plan
    from public.department_plans
   where id = v_item.department_plan_id
     and department_id = v_item.department_id;
  if not found then
    raise exception 'Department plan not found.' using errcode = 'P0002';
  end if;

  select r.code, u.department_id
    into v_actor_role, v_actor_department
    from public.staff_users u
    join public.roles r on r.id = u.role_id
   where u.id = p_actor_id
     and u.active = true;
  if v_actor_role is null then
    raise exception 'Invalid actor.' using errcode = '42501';
  end if;
  if v_actor_role not in ('admin', 'tong_bien_tap', 'pho_tong_bien_tap')
     and (v_actor_department is null or v_actor_department <> v_plan.department_id) then
    raise exception 'Department plan item is outside actor scope.' using errcode = '42501';
  end if;

  -- Safe retry: the row lock makes a double submit return the existing Task.
  if v_item.linked_task_id is not null then
    select * into v_task from public.tasks where id = v_item.linked_task_id;
    if found then
      return v_task;
    end if;
    raise exception 'Linked Task not found.' using errcode = 'P0002';
  end if;

  v_assignee_values := p_input->'assigneeIds';
  v_collaborator_values := p_input->'collaboratorIds';
  if v_assignee_values is null then
    if nullif(p_input->>'assigneeId', '') is null then
      v_assignee_values := '[]'::jsonb;
    else
      v_assignee_values := jsonb_build_array(p_input->>'assigneeId');
    end if;
  end if;
  if jsonb_typeof(v_assignee_values) <> 'array' then
    raise exception 'Assignee list must be an array.' using errcode = '22023';
  end if;
  if v_collaborator_values is not null and jsonb_typeof(v_collaborator_values) <> 'array' then
    raise exception 'Collaborator list must be an array.' using errcode = '22023';
  end if;
  v_assignee_values := v_assignee_values || coalesce(v_collaborator_values, '[]'::jsonb);
  for v_entry in select value from jsonb_array_elements(v_assignee_values) loop
    if jsonb_typeof(v_entry) <> 'string' or nullif(btrim(v_entry #>> '{}'), '') is null then
      raise exception 'Invalid assignee.' using errcode = '22023';
    end if;
    v_value := v_entry #>> '{}';
    begin
      v_user := v_value::uuid;
    exception when invalid_text_representation then
      raise exception 'Invalid assignee.' using errcode = '22023';
    end;
    if array_position(v_assignee_ids, v_user) is null then
      v_assignee_ids := array_append(v_assignee_ids, v_user);
    end if;
  end loop;
  if cardinality(v_assignee_ids) < 1 then
    raise exception 'At least one assignee is required.' using errcode = '22023';
  end if;
  if cardinality(v_assignee_ids) > 1 then
    v_additional_ids := v_assignee_ids[2:cardinality(v_assignee_ids)];
  end if;

  if exists (
    select 1
      from unnest(v_assignee_ids) selected(id)
     where not exists (
       select 1
         from public.staff_users u
        left join public.job_titles jt on jt.id = u.job_title_id
        left join public.roles rr on rr.id = u.role_id
        where u.id = selected.id
          and u.active = true
          and (
            u.department_id = v_plan.department_id
            or exists (
              select 1
                from public.departments ld
               where ld.id = v_plan.department_id
                 and ld.active = true
                 and ld.code = 'leadership'
                 and (
                   lower(coalesce(rr.code, '')) = 'pho_tong_bien_tap'
                   or lower(coalesce(jt.code, '')) = 'truong_phong'
                 )
            )
          )
     )
  ) then
    raise exception 'Assignee is outside department scope.' using errcode = '42501';
  end if;

  if p_input ? 'watcherIds' and jsonb_typeof(p_input->'watcherIds') <> 'array' then
    raise exception 'Watcher list must be an array.' using errcode = '22023';
  end if;
  v_watcher_values := coalesce(p_input->'watcherIds', '[]'::jsonb);
  for v_entry in select value from jsonb_array_elements(v_watcher_values) loop
    if jsonb_typeof(v_entry) <> 'string' or nullif(btrim(v_entry #>> '{}'), '') is null then
      raise exception 'Invalid watcher.' using errcode = '22023';
    end if;
    v_value := v_entry #>> '{}';
    begin
      v_user := v_value::uuid;
    exception when invalid_text_representation then
      raise exception 'Invalid watcher.' using errcode = '22023';
    end;
    if array_position(v_watcher_ids, v_user) is null then
      v_watcher_ids := array_append(v_watcher_ids, v_user);
    end if;
  end loop;
  if exists (
    select 1
      from unnest(v_watcher_ids) selected(id)
     where not exists (select 1 from public.staff_users u where u.id = selected.id and u.active = true)
  ) then
    raise exception 'Inactive assignment participant.' using errcode = '22023';
  end if;

  v_title := nullif(btrim(coalesce(p_input->>'title', v_item.title)), '');
  v_note := nullif(btrim(coalesce(p_input->>'note', '')), '');
  v_description := coalesce(
    v_note,
    nullif(btrim(coalesce(p_input->>'description', '')), ''),
    nullif(btrim(coalesce(v_item.description, '')), ''),
    nullif(btrim(coalesce(v_item.requirements, '')), ''),
    v_title
  );

  v_requirements := p_input->'requirements';
  if v_requirements is not null and jsonb_typeof(v_requirements) = 'array' then
    select string_agg(btrim(value), E'\n' order by ordinality)
      into v_requirements_text
      from jsonb_array_elements_text(v_requirements) with ordinality values(value, ordinality)
     where btrim(value) <> '';
  else
    v_requirements_text := nullif(btrim(coalesce(p_input->>'requirements', v_item.requirements)), '');
  end if;

  begin
    v_due_date := nullif(p_input->>'dueDate', '')::date;
    v_due_time := nullif(p_input->>'dueTime', '')::time;
  exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then
    raise exception 'Invalid assignment deadline.' using errcode = '22023';
  end;
  if v_due_date is null and v_item.due_at is not null then
    v_due_date := (v_item.due_at at time zone 'Asia/Ho_Chi_Minh')::date;
  end if;
  if v_due_time is null and v_item.due_at is not null then
    v_due_time := (v_item.due_at at time zone 'Asia/Ho_Chi_Minh')::time;
  end if;
  v_priority := coalesce(nullif(btrim(p_input->>'priority'), ''), 'normal');
  v_work_status := coalesce(nullif(btrim(p_input->>'workStatus'), ''), 'planned');
  if v_title is null or length(v_title) > 500
     or v_description is null or length(v_description) > 10000
     or v_due_date is null or v_due_time is null
     or v_priority not in ('low', 'normal', 'high', 'urgent')
     or v_work_status not in ('planned', 'in_progress', 'completed', 'cancelled')
     or (v_note is not null and length(v_note) > 2000)
     or p_input->>'recurrenceFrequency' is not null
     or p_input->>'recurrenceEndsOn' is not null then
    raise exception 'Invalid assignment input.' using errcode = '22023';
  end if;

  select manager_id into v_manager
    from public.departments
   where id = v_plan.department_id
     and active = true;
  if v_manager is null then
    raise exception 'Assignee department requires a primary manager.' using errcode = '22023';
  end if;

  -- api_assign_task_v2 remains the only Task insertion authority. Its
  -- task_assignees rows are the delivery source for Task Center and notices.
  v_task := public.api_assign_task_v2(
    p_actor_id,
    v_title,
    v_description,
    v_plan.department_id,
    v_assignee_ids[1],
    v_manager,
    v_due_date,
    v_due_time,
    v_requirements_text,
    v_additional_ids,
    v_watcher_ids,
    null,
    null,
    v_priority
  );

  if v_task.workflow_type is distinct from 'STANDARD' then
    raise exception 'Department Plan assignment must create a STANDARD Task.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.task_assignees
     where task_id = v_task.id
       and user_id = v_assignee_ids[1]
       and assignment_role = 'owner'
  ) then
    raise exception 'Canonical Task owner participant was not created.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from unnest(v_additional_ids) selected(id)
     where not exists (
       select 1 from public.task_assignees
        where task_id = v_task.id
          and user_id = selected.id
          and assignment_role = 'assignee'
     )
  ) then
    raise exception 'Canonical Task assignee participant was not created.' using errcode = 'P0001';
  end if;

  update public.tasks
     set assignment_source = 'department_plan',
         updated_at = now()
   where id = v_task.id
   returning * into v_task;

  update public.department_plan_items
     set linked_task_id = v_task.id,
         assignee_id = v_assignee_ids[1],
         assignment_state = 'assigned',
         due_at = ((v_due_date + v_due_time) at time zone 'Asia/Ho_Chi_Minh'),
         work_status = case v_task.status
           when 'done' then 'completed'
           when 'cancelled' then 'cancelled'
           when 'in_progress' then 'in_progress'
           else 'planned'
         end,
         updated_at = now()
   where id = v_item.id
     and linked_task_id is null;
  if not found then
    raise exception 'Department plan item was linked concurrently.' using errcode = '40001';
  end if;

  insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data)
  values (
    p_actor_id,
    'department_plan',
    'department_plan_items',
    v_item.id,
    'assign_task_v2',
    jsonb_build_object(
      'task_id', v_task.id,
      'department_plan_id', v_item.department_plan_id,
      'assignee_ids', to_jsonb(v_assignee_ids),
      'primary_assignee_id', v_assignee_ids[1],
      'assigned_at', now()
    )
  );

  return v_task;
exception
  when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then
    raise exception 'Invalid Department Plan assignment input.' using errcode = '22023';
end;
$function$;
CREATE OR REPLACE FUNCTION public.api_edit_leave_request(p_actor uuid, p_request_id uuid, p_start_date date, p_end_date date, p_start_period text, p_end_period text, p_leave_type text, p_reason text)
 RETURNS leave_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_row public.leave_requests; v_old public.leave_requests; v_state text;
begin
  select * into v_old from public.leave_requests where id=p_request_id for update;
  if not found then raise exception 'leave request unavailable' using errcode='40001'; end if;
  v_state := case v_old.status when 'approved' then 'APPROVED' when 'cancelled' then 'CANCELLED' else 'PENDING' end;
  perform public.api_assert_creator_mutation(p_actor,v_old.requester_id,v_state,'edit');
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date
     or p_start_period not in ('full','morning','afternoon')
     or p_end_period not in ('full','morning','afternoon')
     or p_leave_type not in ('annual','sick','unpaid','personal','business')
     or length(trim(coalesce(p_reason,''))) not between 3 and 1000
     or (p_start_date=p_end_date and p_start_period<>'full' and p_end_period<>p_start_period) then
    raise exception 'invalid leave request' using errcode='22023';
  end if;
  update public.leave_requests set start_date=p_start_date,end_date=p_end_date,
    start_period=p_start_period,end_period=p_end_period,leave_type=p_leave_type,
    reason=trim(p_reason),updated_at=now()
  where id=p_request_id returning * into v_row;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor,'admin','leave_requests',v_row.id,'edit_leave_request',to_jsonb(v_old),to_jsonb(v_row));
  return v_row;
end $function$;
CREATE OR REPLACE FUNCTION public.api_reconcile_journalism_publication_report_v1(p_actor_id uuid, p_task_id uuid, p_publication_url text, p_published_title text, p_published_at timestamp with time zone, p_note text, p_expected_updated_at timestamp with time zone, p_reason text)
 RETURNS journalism_publication_reports
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_row public.journalism_publication_reports;
  v_url text;
  v_title text;
  v_note text;
  v_reason text;
  v_old jsonb;
  v_new jsonb;
begin
  perform public.api_assert_journalism_access(
    p_actor_id,
    p_task_id,
    'journalism.publication.manage'
  );

  v_url := btrim(coalesce(p_publication_url, ''));
  v_title := nullif(btrim(coalesce(p_published_title, '')), '');
  v_note := nullif(btrim(coalesce(p_note, '')), '');
  v_reason := nullif(btrim(coalesce(p_reason, '')), '');

  if v_url = ''
     or char_length(v_url) > 2048
     or v_url !~* '^https?://[^/@[:space:]]+([/:?][^[:space:]]*)?$' then
    raise exception 'Invalid publication URL.' using errcode = '22023';
  end if;
  if p_published_at is null then
    raise exception 'Published time is required.' using errcode = '22023';
  end if;
  if v_title is not null and char_length(v_title) > 500 then
    raise exception 'Invalid published title.' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 5000 then
    raise exception 'Invalid publication note.' using errcode = '22023';
  end if;
  if v_reason is null or char_length(v_reason) > 2000 then
    raise exception 'Reconciliation reason is required.' using errcode = '22023';
  end if;

  select * into v_row
  from public.journalism_publication_reports
  where task_id = p_task_id
  for update;

  if not found then
    raise exception 'Publication report not found.' using errcode = 'P0002';
  end if;
  if p_expected_updated_at is null
     or v_row.updated_at <> p_expected_updated_at then
    raise exception 'Concurrent publication report update.' using errcode = '40001';
  end if;
  if v_row.publication_url = v_url
     and v_row.published_title is not distinct from v_title
     and v_row.published_at = p_published_at
     and v_row.note is not distinct from v_note then
    raise exception 'Reconciliation did not change the publication report.' using errcode = '22023';
  end if;

  v_old := jsonb_build_object(
    'publication_url', v_row.publication_url,
    'published_title', v_row.published_title,
    'published_at', v_row.published_at,
    'note_length', coalesce(char_length(v_row.note), 0),
    'reported_by', v_row.reported_by
  );

  update public.journalism_publication_reports
  set publication_url = v_url,
      published_title = v_title,
      published_at = p_published_at,
      note = v_note
  where task_id = p_task_id
  returning * into v_row;

  v_new := jsonb_build_object(
    'publication_url', v_row.publication_url,
    'published_title', v_row.published_title,
    'published_at', v_row.published_at,
    'note_length', coalesce(char_length(v_row.note), 0),
    'reported_by', v_row.reported_by,
    'reconciliation_reason_length', char_length(v_reason)
  );

  insert into public.audit_logs(
    actor_id, module, entity_type, entity_id, action, old_data, new_data
  ) values (
    p_actor_id, 'task', 'journalism_publication_report', p_task_id,
    'reconcile_manual_publication_report', v_old, v_new
  );

  return v_row;
end
$function$;
CREATE OR REPLACE FUNCTION public.api_record_journalism_publication_verification_v1(p_actor_id uuid, p_task_id uuid, p_decision text, p_note text, p_expected_report_updated_at timestamp with time zone)
 RETURNS journalism_publication_verifications
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_report public.journalism_publication_reports;
  v_row public.journalism_publication_verifications;
  v_note text;
begin
  perform public.api_assert_journalism_access(
    p_actor_id,
    p_task_id,
    'journalism.publication.verify'
  );

  select * into v_report
  from public.journalism_publication_reports
  where task_id = p_task_id
  for update;
  if not found then
    raise exception 'Publication report not found.' using errcode = 'P0002';
  end if;

  if v_report.reported_by = p_actor_id then
    raise exception 'Reporter cannot verify own publication report.' using errcode = '42501';
  end if;
  if p_expected_report_updated_at is null
     or v_report.updated_at <> p_expected_report_updated_at then
    raise exception 'Publication report changed before verification.' using errcode = '40001';
  end if;
  if p_decision not in ('verified', 'rejected') then
    raise exception 'Invalid verification decision.' using errcode = '22023';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 5000 then
    raise exception 'Invalid verification note.' using errcode = '22023';
  end if;
  if p_decision = 'rejected' and v_note is null then
    raise exception 'Rejection reason required.' using errcode = '22023';
  end if;

  insert into public.journalism_publication_verifications(
    publication_report_id,
    decision,
    note,
    verified_by,
    publication_report_updated_at
  ) values (
    v_report.id,
    p_decision,
    v_note,
    p_actor_id,
    v_report.updated_at
  ) returning * into v_row;

  insert into public.audit_logs(
    actor_id,
    module,
    entity_type,
    entity_id,
    action,
    new_data
  ) values (
    p_actor_id,
    'task',
    'journalism_publication_verification',
    v_report.id,
    case when p_decision = 'verified'
      then 'journalism_publication_verified'
      else 'journalism_publication_rejected'
    end,
    jsonb_build_object(
      'publication_report_id', v_report.id,
      'decision', p_decision,
      'publication_report_updated_at', v_report.updated_at,
      'note_length', coalesce(char_length(v_note), 0)
    )
  );

  return v_row;
end
$function$;
CREATE OR REPLACE FUNCTION public.api_save_monthly_duty_roster(p_actor uuid, p_duty_month date, p_department_id uuid, p_reviewer_id uuid, p_days jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_month date := date_trunc('month',p_duty_month)::date;
  v_month_end date := (date_trunc('month',p_duty_month)+interval '1 month' - interval '1 day')::date;
  v_day jsonb;
  v_assignment jsonb;
  v_date date;
  v_position text;
  v_assignee uuid;
  v_task public.tasks;
  v_existing public.tasks;
  v_department_manager uuid;
  v_reviewer_role text;
  v_reviewer_job text;
  v_reviewer_department uuid;
  v_assignee_job text;
  v_assignee_username text;
  v_assignee_department uuid;
  v_created int := 0;
  v_updated int := 0;
  v_cancelled int := 0;
  v_unchanged int := 0;
begin
  if not public.phase7_is_admin(p_actor) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_duty_month is null or p_duty_month<>v_month or p_department_id is null or p_reviewer_id is null
     or jsonb_typeof(p_days)<>'array' or jsonb_array_length(p_days)>31 then
    raise exception 'invalid duty roster' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('monthly-duty-roster:'||v_month::text));

  select d.manager_id into v_department_manager
  from public.departments d where d.id=p_department_id and d.active=true and d.code <> 'general';
  if not found then raise exception 'selected duty department is excluded' using errcode='22023'; end if;

  select r.code,jt.code,su.department_id
    into v_reviewer_role,v_reviewer_job,v_reviewer_department
  from public.staff_users su join public.roles r on r.id=su.role_id and r.active=true
  left join public.job_titles jt on jt.id=su.job_title_id
  where su.id=p_reviewer_id and su.active=true;
  if not found or not (
    lower(coalesce(v_reviewer_role,'')) in ('tong_bien_tap','pho_tong_bien_tap','truong_phong','pho_truong_phong','phu_trach_phong_bien_tap','phu_trach_phong_phong_vien','phu_trach_phong_tri_su')
    or p_reviewer_id=v_department_manager
    or lower(coalesce(v_reviewer_job,'')) in ('truong_phong','pho_truong_phong')
  ) or (
    lower(coalesce(v_reviewer_role,'')) not in ('tong_bien_tap','pho_tong_bien_tap')
    and v_reviewer_department is distinct from p_department_id
  ) then raise exception 'ineligible duty reviewer' using errcode='22023'; end if;

  create temporary table pg_temp.requested_duty(
    due_date date not null,
    duty_position text not null,
    assignee_id uuid not null,
    primary key(due_date,duty_position)
  ) on commit drop;

  for v_day in select value from jsonb_array_elements(p_days) loop
    if jsonb_typeof(v_day)<>'object' or jsonb_typeof(v_day->'assignments')<>'array'
       or jsonb_array_length(v_day->'assignments') not between 1 and 3 then
      raise exception 'each duty day requires one to three positions' using errcode='22023';
    end if;
    begin v_date := (v_day->>'date')::date;
    exception when others then raise exception 'invalid duty date' using errcode='22023'; end;
    if v_date<v_month or v_date>v_month_end then raise exception 'duty date outside month' using errcode='22023'; end if;
    for v_assignment in select value from jsonb_array_elements(v_day->'assignments') loop
      v_position := v_assignment->>'position';
      begin v_assignee := (v_assignment->>'assigneeId')::uuid;
      exception when others then raise exception 'invalid duty assignee' using errcode='22023'; end;
      if v_position not in ('Xuất bản','Biên tập','Phóng viên') then
        raise exception 'invalid duty position' using errcode='22023';
      end if;
      select jt.code,su.department_id,su.username into v_assignee_job,v_assignee_department,v_assignee_username
      from public.staff_users su left join public.job_titles jt on jt.id=su.job_title_id
      where su.id=v_assignee and su.active=true;
      if not found
         or (v_position='Xuất bản' and lower(coalesce(v_assignee_job,'')) not in ('tong_bien_tap','pho_tong_bien_tap'))
         or (v_position='Biên tập' and lower(coalesce(v_assignee_username,'')) not in ('leson','triduong','thihung','hongninh'))
         or (v_position='Phóng viên' and (v_assignee_department is distinct from p_department_id or exists(select 1 from public.departments d where d.id=v_assignee_department and d.code='general') or lower(coalesce(v_assignee_job,'')) <> 'phong_vien' or lower(coalesce(v_assignee_username,'')) in ('thuphuong','thithuy','ngocanh','minhduc','ducanh','bachduong'))) then
        if v_position='Phóng viên' and exists(select 1 from public.departments d where d.id=v_assignee_department and d.code='general') then
          raise exception 'assignee department is excluded' using errcode='22023';
        end if;
        raise exception 'ineligible duty assignee' using errcode='22023';
      end if;
      begin
        insert into pg_temp.requested_duty values(v_date,v_position,v_assignee);
      exception when unique_violation then
        raise exception 'duplicate duty assignment' using errcode='22023';
      end;
    end loop;
  end loop;

  for v_existing in
    select * from public.tasks
    where task_category='duty' and duty_month=v_month and status<>'cancelled'
    order by id for update
  loop
    select * into v_task from public.tasks t
    where false;
    if exists(select 1 from pg_temp.requested_duty r where r.due_date=v_existing.due_date and r.duty_position=v_existing.duty_position) then
      select r.assignee_id into v_assignee from pg_temp.requested_duty r
      where r.due_date=v_existing.due_date and r.duty_position=v_existing.duty_position;
      if v_existing.department_id=p_department_id and v_existing.reviewer_id=p_reviewer_id and v_existing.assignee_id=v_assignee and (v_existing.status<>'new' or v_existing.due_time=time '22:00') then
        v_unchanged:=v_unchanged+1;
      else
        if v_existing.status<>'new' then raise exception 'active duty task cannot be reassigned' using errcode='40001'; end if;
        update public.tasks set department_id=p_department_id,reviewer_id=p_reviewer_id,
          assignee_id=v_assignee,owner_id=v_assignee,due_time=time '22:00',updated_at=now()
        where id=v_existing.id returning * into v_task;
        delete from public.task_assignees where task_id=v_existing.id and assignment_role='owner';
        insert into public.task_assignees(task_id,user_id,assignment_role,status)
        values(v_existing.id,v_assignee,'owner','todo');
        insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
        values(p_actor,'tasks','tasks',v_existing.id,'update_duty',to_jsonb(v_existing),to_jsonb(v_task));
        v_updated:=v_updated+1;
      end if;
      delete from pg_temp.requested_duty where due_date=v_existing.due_date and duty_position=v_existing.duty_position;
    else
      if v_existing.status<>'new' then raise exception 'active duty task cannot be cancelled' using errcode='40001'; end if;
      update public.tasks set status='cancelled',cancelled_at=now(),cancelled_by=p_actor,
        cancel_reason='Cập nhật bảng lịch trực tháng',updated_at=now()
      where id=v_existing.id returning * into v_task;
      insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id)
      values(v_existing.id,v_existing.status,'cancelled','Cập nhật bảng lịch trực tháng',p_actor);
      insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
      values(p_actor,'tasks','tasks',v_existing.id,'cancel_duty',to_jsonb(v_existing),to_jsonb(v_task));
      v_cancelled:=v_cancelled+1;
    end if;
  end loop;

  for v_date,v_position,v_assignee in select due_date,duty_position,assignee_id from pg_temp.requested_duty order by due_date,duty_position loop
    insert into public.tasks(title,description,department_id,assignee_id,owner_id,reviewer_id,created_by,
      assignment_mode,due_date,due_time,status,progress_percent,plan_period,self_claimable,task_type,start_date,
      evaluation_criteria,priority,task_category,duty_month,duty_position)
    values('Trực '||v_position||' ngày '||v_date,'Lịch trực tháng '||to_char(v_month,'YYYY-MM')||' · Vị trí: '||v_position,
      p_department_id,v_assignee,v_assignee,p_reviewer_id,p_actor,'individual',v_date,'22:00','new',0,'ad_hoc',false,
      'assigned',v_date,'Lịch trực được tính trong kỳ đánh giá tháng.','normal','duty',v_month,v_position)
    returning * into v_task;
    insert into public.task_assignees(task_id,user_id,assignment_role,status) values(v_task.id,v_assignee,'owner','todo');
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
    values(p_actor,'tasks','tasks',v_task.id,'create_duty',to_jsonb(v_task));
    v_created:=v_created+1;
  end loop;
  return jsonb_build_object('created',v_created,'updated',v_updated,'cancelled',v_cancelled,'unchanged',v_unchanged);
end
$function$;
CREATE OR REPLACE FUNCTION public.api_set_event_assignment_status(p_actor uuid, p_id uuid, p_expected_revision bigint, p_action text)
 RETURNS work_schedules
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor_department uuid;
  v_role text;
  v_job text;
  v_old public.work_schedules;
  v_row public.work_schedules;
  v_status text;
  v_audit_action text;
begin
  if p_action not in ('cancel','complete') then raise exception 'invalid event action' using errcode='22023'; end if;
  select u.department_id, lower(r.code), lower(coalesce(jt.code, ''))
    into v_actor_department, v_role, v_job
  from public.staff_users u join public.roles r on r.id=u.role_id
  left join public.job_titles jt on jt.id=u.job_title_id
  where u.id=p_actor and u.active=true;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  if v_role = 'pho_truong_phong' then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select * into v_old from public.work_schedules where id=p_id for update;
  if not found or v_old.event_assignment_kind <> 'leadership' then raise exception 'event unavailable' using errcode='P0002'; end if;
  if not (v_role in ('admin','tong_bien_tap','pho_tong_bien_tap')
      or (v_job='truong_phong' and v_old.created_by=p_actor and v_old.creator_department_id=v_actor_department))
  then raise exception 'forbidden' using errcode='42501'; end if;
  if p_expected_revision is null or p_expected_revision <> v_old.workflow_revision
     or v_old.event_status <> 'SCHEDULED' then raise exception 'stale event' using errcode='40001'; end if;
  v_status := case when p_action='cancel' then 'CANCELLED' else 'COMPLETED' end;
  v_audit_action := case when p_action='cancel' then 'cancel_event' else 'complete_event' end;
  update public.work_schedules set event_status=v_status,workflow_revision=workflow_revision+1,updated_at=now()
    where id=p_id returning * into v_row;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
    values(p_actor,'admin','work_schedules',v_row.id,v_audit_action,to_jsonb(v_old),to_jsonb(v_row));
  return v_row;
end $function$;
CREATE OR REPLACE FUNCTION public.api_update_event_assignment(p_actor uuid, p_id uuid, p_expected_revision bigint, p_work_date date, p_end_date date, p_start_time time without time zone, p_end_time time without time zone, p_event_type text, p_title text, p_location text, p_notes text, p_reporter_ids uuid[])
 RETURNS work_schedules
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor_department uuid;
  v_role text;
  v_job text;
  v_old public.work_schedules;
  v_row public.work_schedules;
  v_reporter uuid;
  v_assignment public.work_schedule_event_assignments;
begin
  select u.department_id, lower(r.code), lower(coalesce(jt.code, ''))
    into v_actor_department, v_role, v_job
  from public.staff_users u join public.roles r on r.id=u.role_id
  left join public.job_titles jt on jt.id=u.job_title_id
  where u.id=p_actor and u.active=true;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  if v_role = 'pho_truong_phong' then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select * into v_old from public.work_schedules where id=p_id for update;
  if not found or v_old.event_assignment_kind <> 'leadership' then
    raise exception 'event unavailable' using errcode='P0002';
  end if;
  if not (v_role in ('admin','tong_bien_tap','pho_tong_bien_tap')
      or (v_job='truong_phong' and v_old.created_by=p_actor and v_old.creator_department_id=v_actor_department))
  then raise exception 'forbidden' using errcode='42501'; end if;
  if p_expected_revision is null or p_expected_revision <> v_old.workflow_revision then
    raise exception 'stale event' using errcode='40001';
  end if;
  if v_old.event_status <> 'SCHEDULED' then raise exception 'event is terminal' using errcode='42501'; end if;
  if p_work_date is null or p_end_date is null or p_end_date < p_work_date
     or p_start_time is null or p_end_time is null
     or (p_work_date = p_end_date and p_end_time <= p_start_time)
     or length(trim(coalesce(p_title,''))) not between 1 and 500
     or length(trim(coalesce(p_event_type,''))) not between 1 and 100
     or length(coalesce(p_location,'')) > 500 or length(coalesce(p_notes,'')) > 2000
     or coalesce(array_length(p_reporter_ids,1),0) not between 1 and 50
     or exists(select 1 from unnest(p_reporter_ids) x group by x having count(*) > 1)
  then raise exception 'invalid event' using errcode='22023'; end if;
  if exists (
    select 1 from unnest(p_reporter_ids) x
    where not exists (
      select 1 from public.staff_users s left join public.roles sr on sr.id=s.role_id
      left join public.job_titles sj on sj.id=s.job_title_id
      where s.id=x and s.active=true
        and (lower(coalesce(sj.code,'')) like 'phong_vien%' or lower(coalesce(sr.code,''))='phong_vien')
        and (v_role in ('admin','tong_bien_tap','pho_tong_bien_tap') or s.department_id=v_actor_department)
    )
  ) then raise exception 'invalid reporter scope' using errcode='42501'; end if;
  for v_assignment in
    select * from public.work_schedule_event_assignments
    where event_id=p_id and not (staff_id=any(p_reporter_ids))
  loop
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data)
      values(p_actor,'admin','work_schedule_event_assignments',p_id,'unassign_reporter',
             jsonb_build_object('event_id',p_id,'staff_id',v_assignment.staff_id,
                                'assigned_by',v_assignment.assigned_by,'assigned_at',v_assignment.assigned_at));
  end loop;
  delete from public.work_schedule_event_assignments
    where event_id=p_id and not (staff_id=any(p_reporter_ids));
  update public.work_schedules set
    work_date=p_work_date,end_date=p_end_date,start_time=p_start_time,end_time=p_end_time,
    title=trim(p_title),location=nullif(trim(p_location),''),notes=nullif(trim(p_notes),''),
    participant_ids=p_reporter_ids,event_type=trim(p_event_type),workflow_revision=workflow_revision+1,
    updated_at=now()
  where id=p_id returning * into v_row;
  foreach v_reporter in array p_reporter_ids loop
    if not exists (
      select 1 from public.work_schedule_event_assignments
      where event_id=v_row.id and staff_id=v_reporter
    ) then
      insert into public.work_schedule_event_assignments(event_id,staff_id,assigned_by)
        values(v_row.id,v_reporter,p_actor);
      insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
        values(p_actor,'admin','work_schedule_event_assignments',v_row.id,'assign_reporter',
               jsonb_build_object('event_id',v_row.id,'staff_id',v_reporter,'assigned_by',p_actor));
    end if;
  end loop;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
    values(p_actor,'admin','work_schedules',v_row.id,'update_event',to_jsonb(v_old),to_jsonb(v_row));
  return v_row;
end $function$;
CREATE OR REPLACE FUNCTION public.api_update_journalism_metadata_v1(p_actor_id uuid, p_task_id uuid, p_work_kind_id uuid, p_planned_publication_at timestamp with time zone, p_location text, p_editorial_notes text, p_expected_updated_at timestamp with time zone)
 RETURNS journalism_task_details
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_row public.journalism_task_details; v_kind public.journalism_work_kinds; v_old jsonb; v_new jsonb;
begin
  perform public.api_assert_journalism_access(p_actor_id,p_task_id,'journalism.metadata.update');
  select * into v_row from public.journalism_task_details where task_id=p_task_id for update;
  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
  if p_expected_updated_at is not null and v_row.updated_at<>p_expected_updated_at then raise exception 'Concurrent update.' using errcode='40001'; end if;
  if v_row.publication_status in ('published','withdrawn') and p_planned_publication_at is distinct from v_row.planned_publication_at then raise exception 'Planned publication is locked.' using errcode='22023'; end if;
  if v_row.publication_status='scheduled' and p_planned_publication_at is null then raise exception 'Planned publication is required.' using errcode='22023'; end if;
  select * into v_kind from public.journalism_work_kinds where id=p_work_kind_id and is_active=true;
  if not found then raise exception 'Inactive work kind.' using errcode='22023'; end if;
  if p_location is not null and char_length(p_location)>500 then raise exception 'Invalid location.' using errcode='22023'; end if;
  if p_editorial_notes is not null and char_length(p_editorial_notes)>10000 then raise exception 'Invalid editorial notes.' using errcode='22023'; end if;
  v_old=jsonb_build_object('work_kind_id',v_row.work_kind_id,'planned_publication_at',v_row.planned_publication_at,'location_length',coalesce(char_length(v_row.location),0),'editorial_notes_length',coalesce(char_length(v_row.editorial_notes),0));
  update public.journalism_task_details set work_kind_id=p_work_kind_id,planned_publication_at=p_planned_publication_at,location=nullif(btrim(p_location),''),editorial_notes=nullif(btrim(p_editorial_notes),'') where task_id=p_task_id returning * into v_row;
  v_new=jsonb_build_object('work_kind_id',v_row.work_kind_id,'planned_publication_at',v_row.planned_publication_at,'location_length',coalesce(char_length(v_row.location),0),'editorial_notes_length',coalesce(char_length(v_row.editorial_notes),0));
  if v_old<>v_new then insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values(p_actor_id,'task','journalism_task_details',p_task_id,'update_journalism_metadata',v_old,v_new); end if;
  return v_row;
end
$function$;
CREATE OR REPLACE FUNCTION public.api_upsert_journalism_publication_report_v1(p_actor_id uuid, p_task_id uuid, p_publication_url text, p_published_title text, p_published_at timestamp with time zone, p_note text, p_expected_updated_at timestamp with time zone)
 RETURNS journalism_publication_reports
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_row public.journalism_publication_reports;
  v_url text;
  v_title text;
  v_note text;
  v_old jsonb;
  v_new jsonb;
begin
  perform public.api_assert_journalism_access(
    p_actor_id,
    p_task_id,
    'journalism.publication.manage'
  );

  v_url := btrim(coalesce(p_publication_url, ''));
  v_title := nullif(btrim(coalesce(p_published_title, '')), '');
  v_note := nullif(btrim(coalesce(p_note, '')), '');

  if v_url = ''
     or char_length(v_url) > 2048
     or v_url !~* '^https?://[^/@[:space:]]+([/:?][^[:space:]]*)?$' then
    raise exception 'Invalid publication URL.' using errcode = '22023';
  end if;
  if p_published_at is null then
    raise exception 'Published time is required.' using errcode = '22023';
  end if;
  if v_title is not null and char_length(v_title) > 500 then
    raise exception 'Invalid published title.' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 5000 then
    raise exception 'Invalid publication note.' using errcode = '22023';
  end if;

  select * into v_row
  from public.journalism_publication_reports
  where task_id = p_task_id
  for update;

  if found then
    if p_expected_updated_at is null
       or v_row.updated_at <> p_expected_updated_at then
      raise exception 'Concurrent publication report update.' using errcode = '40001';
    end if;
    v_old := jsonb_build_object(
      'publication_url', v_row.publication_url,
      'published_title', v_row.published_title,
      'published_at', v_row.published_at,
      'note_length', coalesce(char_length(v_row.note), 0),
      'reported_by', v_row.reported_by
    );
    update public.journalism_publication_reports
    set publication_url = v_url,
        published_title = v_title,
        published_at = p_published_at,
        note = v_note
    where task_id = p_task_id
    returning * into v_row;
  else
    if p_expected_updated_at is not null then
      raise exception 'Concurrent publication report update.' using errcode = '40001';
    end if;
    insert into public.journalism_publication_reports(
      task_id,
      publication_url,
      published_title,
      published_at,
      note,
      reported_by
    ) values (
      p_task_id,
      v_url,
      v_title,
      p_published_at,
      v_note,
      p_actor_id
    )
    returning * into v_row;
  end if;

  v_new := jsonb_build_object(
    'publication_url', v_row.publication_url,
    'published_title', v_row.published_title,
    'published_at', v_row.published_at,
    'note_length', coalesce(char_length(v_row.note), 0),
    'reported_by', v_row.reported_by
  );

  insert into public.audit_logs(
    actor_id,
    module,
    entity_type,
    entity_id,
    action,
    old_data,
    new_data
  ) values (
    p_actor_id,
    'task',
    'journalism_publication_report',
    p_task_id,
    case when v_old is null
      then 'create_manual_publication_report'
      else 'update_manual_publication_report'
    end,
    v_old,
    v_new
  );

  return v_row;
end
$function$;
CREATE OR REPLACE FUNCTION public.claim_task_plan(p_actor_id uuid, p_task_id uuid)
 RETURNS tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_task public.tasks; v_reviewer uuid; v_role text;
begin
 select r.code into v_role from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor_id and u.active;
 if v_role is null or v_role='tbt_read_only' then raise exception 'Tài khoản không được tự nhận kế hoạch.' using errcode='42501'; end if;
 select * into v_task from public.tasks where id=p_task_id and self_claimable=true and plan_period in ('daily','weekly') and status='new' and assignee_id is null for update;
 if not found then raise exception 'Kế hoạch không còn khả dụng để tự nhận.' using errcode='40001'; end if;
 select case when d.code='leadership' then (select u.id from public.staff_users u join public.roles r on r.id=u.role_id where r.code='tong_bien_tap' and u.active limit 1) else d.manager_id end into v_reviewer from public.departments d where d.id=v_task.department_id;
 update public.tasks set assignee_id=p_actor_id,owner_id=p_actor_id,reviewer_id=v_reviewer,status='waiting',updated_at=now() where id=p_task_id returning * into v_task;
 insert into public.task_assignees(task_id,user_id,assignment_role,status) values(p_task_id,p_actor_id,'owner','todo') on conflict(task_id,user_id) do update set assignment_role='owner',status='todo';
 return v_task;
end;
$function$;
DO $$
DECLARE mismatches text;
BEGIN
  SELECT string_agg(label || ' expected ' || expected_md5 || ' got ' || actual_md5, E'\n' ORDER BY label) INTO mismatches FROM (
    SELECT 'api_asset_status_request_review(p_actor_id uuid, p_request_id uuid, p_decision text, p_review_note text)', md5(pg_get_functiondef('public.api_asset_status_request_review(uuid, uuid, text, text)'::regprocedure)), '15c65f22af0f3b711fd613d81ae9875d'
    UNION ALL
    SELECT 'api_assign_task_batch_v1(p_actor_id uuid, p_batch_id uuid, p_department_id uuid, p_assignee_id uuid, p_tasks jsonb)', md5(pg_get_functiondef('public.api_assign_task_batch_v1(uuid, uuid, uuid, uuid, jsonb)'::regprocedure)), 'cdf257db9aeea1dc221080a3ee230484'
    UNION ALL
    SELECT 'api_cancel_leave_request(p_actor uuid, p_request_id uuid)', md5(pg_get_functiondef('public.api_cancel_leave_request(uuid, uuid)'::regprocedure)), 'db50a7032adfc8b905406a823dac2b4a'
    UNION ALL
    SELECT 'api_cancel_personal_work_schedule(p_actor uuid, p_id uuid, p_expected_revision bigint)', md5(pg_get_functiondef('public.api_cancel_personal_work_schedule(uuid, uuid, bigint)'::regprocedure)), '166f2579b421bbc17a1058e6a809e336'
    UNION ALL
    SELECT 'api_create_personal_work_schedule(p_actor uuid, p_id uuid, p_work_date date, p_end_date date, p_plan_type text, p_start_time time without time zone, p_end_time time without time zone, p_title text, p_location text, p_notes text, p_participant_ids uuid[], p_expected_revision bigint)', md5(pg_get_functiondef('public.api_create_personal_work_schedule(uuid, uuid, date, date, text, time without time zone, time without time zone, text, text, text, uuid[], bigint)'::regprocedure)), '1632f7a1d810acd719be9425fe2abbe6'
    UNION ALL
    SELECT 'api_create_quick_report_v1_legacy(p_actor_id uuid, p_request_id uuid, p_rows jsonb)', md5(pg_get_functiondef('public.api_create_quick_report_v1_legacy(uuid, uuid, jsonb)'::regprocedure)), '0403692c4b07c54c9aca5f4e5498cd1c'
    UNION ALL
    SELECT 'api_department_plan_assign_core(p_actor_id uuid, p_item_id uuid, p_input jsonb)', md5(pg_get_functiondef('public.api_department_plan_assign_core(uuid, uuid, jsonb)'::regprocedure)), 'e1010005700d8ac9409d2a867d29a002'
    UNION ALL
    SELECT 'api_edit_leave_request(p_actor uuid, p_request_id uuid, p_start_date date, p_end_date date, p_start_period text, p_end_period text, p_leave_type text, p_reason text)', md5(pg_get_functiondef('public.api_edit_leave_request(uuid, uuid, date, date, text, text, text, text)'::regprocedure)), 'a321a655ffd2643bd4aff9a1fc548f1f'
    UNION ALL
    SELECT 'api_reconcile_journalism_publication_report_v1(p_actor_id uuid, p_task_id uuid, p_publication_url text, p_published_title text, p_published_at timestamp with time zone, p_note text, p_expected_updated_at timestamp with time zone, p_reason text)', md5(pg_get_functiondef('public.api_reconcile_journalism_publication_report_v1(uuid, uuid, text, text, timestamp with time zone, text, timestamp with time zone, text)'::regprocedure)), '8570148254e7a4a6dcc53e16813c013a'
    UNION ALL
    SELECT 'api_record_journalism_publication_verification_v1(p_actor_id uuid, p_task_id uuid, p_decision text, p_note text, p_expected_report_updated_at timestamp with time zone)', md5(pg_get_functiondef('public.api_record_journalism_publication_verification_v1(uuid, uuid, text, text, timestamp with time zone)'::regprocedure)), 'c1563f8ce7b943b1808a487daaf22ee0'
    UNION ALL
    SELECT 'api_save_monthly_duty_roster(p_actor uuid, p_duty_month date, p_department_id uuid, p_reviewer_id uuid, p_days jsonb)', md5(pg_get_functiondef('public.api_save_monthly_duty_roster(uuid, date, uuid, uuid, jsonb)'::regprocedure)), '055c72d0a027a3a13aa3dbf375b4ab8d'
    UNION ALL
    SELECT 'api_set_event_assignment_status(p_actor uuid, p_id uuid, p_expected_revision bigint, p_action text)', md5(pg_get_functiondef('public.api_set_event_assignment_status(uuid, uuid, bigint, text)'::regprocedure)), '5571247093d7b5ff99005df460fbf5b2'
    UNION ALL
    SELECT 'api_update_event_assignment(p_actor uuid, p_id uuid, p_expected_revision bigint, p_work_date date, p_end_date date, p_start_time time without time zone, p_end_time time without time zone, p_event_type text, p_title text, p_location text, p_notes text, p_reporter_ids uuid[])', md5(pg_get_functiondef('public.api_update_event_assignment(uuid, uuid, bigint, date, date, time without time zone, time without time zone, text, text, text, text, uuid[])'::regprocedure)), '9836ae31568bb72adb4fd814ba9c39fc'
    UNION ALL
    SELECT 'api_update_journalism_metadata_v1(p_actor_id uuid, p_task_id uuid, p_work_kind_id uuid, p_planned_publication_at timestamp with time zone, p_location text, p_editorial_notes text, p_expected_updated_at timestamp with time zone)', md5(pg_get_functiondef('public.api_update_journalism_metadata_v1(uuid, uuid, uuid, timestamp with time zone, text, text, timestamp with time zone)'::regprocedure)), '0077086589d42dc6fe5ecef15f24790b'
    UNION ALL
    SELECT 'api_upsert_journalism_publication_report_v1(p_actor_id uuid, p_task_id uuid, p_publication_url text, p_published_title text, p_published_at timestamp with time zone, p_note text, p_expected_updated_at timestamp with time zone)', md5(pg_get_functiondef('public.api_upsert_journalism_publication_report_v1(uuid, uuid, text, text, timestamp with time zone, text, timestamp with time zone)'::regprocedure)), '34b92cc141dc19e2be21c6251548db57'
    UNION ALL
    SELECT 'claim_task_plan(p_actor_id uuid, p_task_id uuid)', md5(pg_get_functiondef('public.claim_task_plan(uuid, uuid)'::regprocedure)), '204f12603ac744d3dbb2ba138fa3f110'
  ) AS inventory(label, actual_md5, expected_md5) WHERE actual_md5 IS DISTINCT FROM expected_md5;
  IF mismatches IS NOT NULL THEN RAISE EXCEPTION 'business errcode 55000 revert md5 mismatch: %', mismatches USING errcode='P0001'; END IF;
END
$$;

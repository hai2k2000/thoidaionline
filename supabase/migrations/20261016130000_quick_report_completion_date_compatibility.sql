begin;

-- Preserve the existing RPC signatures while carrying a date-only completion
-- value through the compatibility boundary. Legacy payloads fall back to
-- work_date, so old clients remain valid.
create or replace function public.api_create_quick_report_v1_legacy(
  p_actor_id uuid,
  p_request_id uuid,
  p_rows jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
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

create or replace function public.api_create_quick_report_v1(
  p_actor_id uuid,
  p_request_id uuid,
  p_rows jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_rows jsonb;
begin
  if not public.rbac_v2_has_effective_scope(
    p_actor_id, 'task.quick_report.create', array['self', 'all']::text[]
  ) then
    raise exception 'Quick report permission denied.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'title', item->>'title',
    'category', item->>'category',
    'work_date', coalesce(item->>'work_date', item->>'start_date'),
    'completed_date', case
      when nullif(item->>'completed_date', '') is not null then to_jsonb(item->>'completed_date')
      when nullif(item->>'completion_date', '') is not null then to_jsonb(item->>'completion_date')
      else 'null'::jsonb
    end,
    'started_time', coalesce(nullif(item->>'started_time', ''), '00:00'),
    'completed_time', case
      when item ? 'completed_time' then item->'completed_time'
      when nullif(item->>'completed_date', '') is not null then to_jsonb('00:00'::text)
      else 'null'::jsonb
    end,
    'status', item->>'status', 'notes', item->>'notes'
  ) order by ordinal), '[]'::jsonb)
  into v_rows
  from jsonb_array_elements(p_rows) with ordinality as expanded(item, ordinal);

  return public.api_create_quick_report_v1_legacy(p_actor_id, p_request_id, v_rows);
end
$function$;

notify pgrst, 'reload schema';

commit;

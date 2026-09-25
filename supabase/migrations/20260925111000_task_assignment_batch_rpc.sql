begin;

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

revoke all on function public.api_assign_task_batch_v1(uuid,uuid,uuid,uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.api_assign_task_batch_v1(uuid,uuid,uuid,uuid,jsonb)
  to service_role;
alter function public.api_assign_task_batch_v1(uuid,uuid,uuid,uuid,jsonb)
  owner to postgres;

notify pgrst,'reload schema';
commit;

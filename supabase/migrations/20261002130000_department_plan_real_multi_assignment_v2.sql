begin;

-- One canonical transaction for every explicit Department Plan assignment.
-- The existing api_assign_task_v2 remains the only Task creation authority.
create or replace function public.api_department_plan_assign_core(
  p_actor_id uuid,
  p_item_id uuid,
  p_input jsonb
) returns public.tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
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

-- V2 full assignment wrapper: preserve the existing API shape while sharing
-- validation, participant ordering, link protection, and audit behavior.
create or replace function public.api_assign_department_plan_task_v2(
  p_actor_id uuid,
  p_item_id uuid,
  p_input jsonb
) returns public.tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_input jsonb;
begin
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'Invalid assignment input.' using errcode = '22023';
  end if;
  -- The shared core accepts both the new ordered array and the legacy
  -- assigneeId/collaboratorIds shape, so no caller can bypass normalization.
  return public.api_department_plan_assign_core(p_actor_id, p_item_id, p_input);
end;
$function$;

-- Compact V1 wrapper remains compatible for existing callers.
create or replace function public.api_quick_assign_department_plan_task_v1(
  p_actor_id uuid,
  p_item_id uuid,
  p_assignee_id uuid,
  p_due_date date,
  p_due_time time,
  p_priority text default 'normal',
  p_note text default null
) returns public.tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  return public.api_department_plan_assign_core(
    p_actor_id,
    p_item_id,
    jsonb_build_object(
      'assigneeIds', jsonb_build_array(p_assignee_id::text),
      'dueDate', p_due_date::text,
      'dueTime', p_due_time::text,
      'priority', p_priority,
      'note', p_note
    )
  );
end;
$function$;

-- Legacy explicit conversion now uses the same core and remains retry-safe.
create or replace function public.api_create_department_plan_task(
  p_actor_id uuid,
  p_item_id uuid
) returns public.tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_item public.department_plan_items;
begin
  select * into v_item from public.department_plan_items where id = p_item_id;
  if not found then
    raise exception 'Department plan item not found.' using errcode = 'P0002';
  end if;
  return public.api_department_plan_assign_core(
    p_actor_id,
    p_item_id,
    jsonb_build_object(
      'assigneeIds', jsonb_build_array(v_item.assignee_id::text),
      'dueDate', case when v_item.due_at is null then null else (v_item.due_at at time zone 'Asia/Ho_Chi_Minh')::date::text end,
      'dueTime', case when v_item.due_at is null then null else (v_item.due_at at time zone 'Asia/Ho_Chi_Minh')::time::text end,
      'workStatus', v_item.work_status,
      'requirements', coalesce(v_item.requirements, '')
    )
  );
end;
$function$;

-- Create a Plan row and its canonical Task in one transaction.
create or replace function public.api_create_department_plan_task_v2(
  p_actor_id uuid,
  p_plan_id uuid,
  p_input jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_plan public.department_plans;
  v_item public.department_plan_items;
  v_task public.tasks;
  v_actor_role text;
  v_actor_department uuid;
  v_title text;
  v_description text;
  v_requirements text;
  v_due_date date;
  v_due_time time;
begin
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'Invalid assignment input.' using errcode = '22023';
  end if;
  perform public.api_assert_task_action(p_actor_id, null, 'assign');
  select * into v_plan from public.department_plans where id = p_plan_id for update;
  if not found then
    raise exception 'Department plan not found.' using errcode = 'P0002';
  end if;
  select r.code, u.department_id into v_actor_role, v_actor_department
    from public.staff_users u join public.roles r on r.id = u.role_id
   where u.id = p_actor_id and u.active = true;
  if v_actor_role is null then
    raise exception 'Invalid actor.' using errcode = '42501';
  end if;
  if v_actor_role not in ('admin', 'tong_bien_tap', 'pho_tong_bien_tap')
     and (v_actor_department is null or v_actor_department <> v_plan.department_id) then
    raise exception 'Department plan is outside actor scope.' using errcode = '42501';
  end if;
  v_title := nullif(btrim(p_input->>'title'), '');
  v_description := nullif(btrim(coalesce(p_input->>'description', '')), '');
  v_requirements := nullif(btrim(coalesce(p_input->>'requirements', '')), '');
  if jsonb_typeof(p_input->'requirements') = 'array' then
    select string_agg(btrim(value), E'\n' order by ordinality) into v_requirements
      from jsonb_array_elements_text(p_input->'requirements') with ordinality values(value, ordinality)
     where btrim(value) <> '';
  end if;
  begin
    v_due_date := nullif(p_input->>'dueDate', '')::date;
    v_due_time := nullif(p_input->>'dueTime', '')::time;
  exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then
    raise exception 'Invalid assignment deadline.' using errcode = '22023';
  end;
  if v_title is null or length(v_title) > 500 or v_due_date is null or v_due_time is null then
    raise exception 'Invalid assignment input.' using errcode = '22023';
  end if;
  insert into public.department_plan_items(
    department_plan_id, department_id, title, description, requirements, due_at,
    assignee_id, assignment_state, work_status, created_by
  ) values (
    v_plan.id, v_plan.department_id, v_title, v_description, v_requirements,
    ((v_due_date + v_due_time) at time zone 'Asia/Ho_Chi_Minh'),
    null, 'unassigned', coalesce(nullif(p_input->>'workStatus', ''), 'planned'), p_actor_id
  ) returning * into v_item;

  v_task := public.api_department_plan_assign_core(p_actor_id, v_item.id, p_input);
  select * into v_item from public.department_plan_items where id = v_item.id;
  return jsonb_build_object('task', to_jsonb(v_task), 'item', to_jsonb(v_item));
exception
  when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then
    raise exception 'Invalid assignment input.' using errcode = '22023';
end;
$function$;

-- Generic Plan writes may not claim a new assignment without a Task. Existing
-- legacy assigned rows are still editable for content and are never backfilled.
create or replace function public.guard_department_plan_assignment_claim()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if new.linked_task_id is not null
     and new.assignment_state is distinct from 'assigned' then
    raise exception 'Linked Department Plan items must remain assigned.' using errcode = '23514';
  end if;
  if new.assignment_state = 'assigned' and new.linked_task_id is null then
    if tg_op = 'UPDATE'
       and old.assignment_state = 'assigned'
       and old.linked_task_id is null
       and new.assignee_id is not distinct from old.assignee_id then
      return new;
    end if;
    raise exception 'Assigned Department Plan items require a linked Task.' using errcode = '23514';
  end if;
  return new;
end;
$function$;

drop trigger if exists department_plan_assignment_claim_guard on public.department_plan_items;
create trigger department_plan_assignment_claim_guard
before insert or update on public.department_plan_items
for each row execute function public.guard_department_plan_assignment_claim();

revoke all on function public.api_department_plan_assign_core(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.api_assign_department_plan_task_v2(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.api_quick_assign_department_plan_task_v1(uuid, uuid, uuid, date, time, text, text) from public, anon, authenticated;
revoke all on function public.api_create_department_plan_task(uuid, uuid) from public, anon, authenticated;
revoke all on function public.api_create_department_plan_task_v2(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.api_department_plan_assign_core(uuid, uuid, jsonb) to service_role;
grant execute on function public.api_assign_department_plan_task_v2(uuid, uuid, jsonb) to service_role;
grant execute on function public.api_quick_assign_department_plan_task_v1(uuid, uuid, uuid, date, time, text, text) to service_role;
grant execute on function public.api_create_department_plan_task(uuid, uuid) to service_role;
grant execute on function public.api_create_department_plan_task_v2(uuid, uuid, jsonb) to service_role;
alter function public.api_department_plan_assign_core(uuid, uuid, jsonb) owner to postgres;
alter function public.api_assign_department_plan_task_v2(uuid, uuid, jsonb) owner to postgres;
alter function public.api_quick_assign_department_plan_task_v1(uuid, uuid, uuid, date, time, text, text) owner to postgres;
alter function public.api_create_department_plan_task(uuid, uuid) owner to postgres;
alter function public.api_create_department_plan_task_v2(uuid, uuid, jsonb) owner to postgres;

notify pgrst, 'reload schema';
commit;

begin;

-- CP9B additive contract: canonical Task fields are supplied by the dialog,
-- while the Plan Item and link are protected by one transaction and row lock.
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
  v_item public.department_plan_items;
  v_plan public.department_plans;
  v_task public.tasks;
  v_actor_role text;
  v_actor_department uuid;
  v_manager uuid;
  v_title text;
  v_description text;
  v_assignee uuid;
  v_due_date date;
  v_due_time time;
  v_priority text;
  v_requirements jsonb;
  v_collaborators uuid[];
  v_watchers uuid[];
begin
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'Invalid assignment input.' using errcode = '22023';
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

  select r.code, u.department_id into v_actor_role, v_actor_department
    from public.staff_users u join public.roles r on r.id = u.role_id
   where u.id = p_actor_id and u.active = true;
  if v_actor_role is null then
    raise exception 'Invalid actor.' using errcode = '42501';
  end if;
  if v_actor_role not in ('admin', 'tong_bien_tap', 'pho_tong_bien_tap')
     and (v_actor_department is null or v_actor_department <> v_plan.department_id) then
    raise exception 'Department plan item is outside actor scope.' using errcode = '42501';
  end if;

  -- A retry or stale dialog resolves to the already-linked Task, never a duplicate.
  if v_item.linked_task_id is not null then
    select * into v_task from public.tasks where id = v_item.linked_task_id;
    if found then return v_task; end if;
    raise exception 'Linked Task not found.' using errcode = 'P0002';
  end if;

  v_title := nullif(btrim(p_input->>'title'), '');
  v_description := nullif(btrim(p_input->>'description'), '');
  v_assignee := nullif(p_input->>'assigneeId', '')::uuid;
  v_due_date := (p_input->>'dueDate')::date;
  v_due_time := (p_input->>'dueTime')::time;
  v_priority := coalesce(nullif(p_input->>'priority', ''), 'normal');
  v_requirements := coalesce(p_input->'requirements', '[]'::jsonb);
  if jsonb_typeof(v_requirements) <> 'array' then
    raise exception 'Invalid requirements.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_input->'collaboratorIds', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_input->'watcherIds', '[]'::jsonb)) <> 'array' then
    raise exception 'Invalid participants.' using errcode = '22023';
  end if;
  v_collaborators := coalesce(array(select value::text::uuid from jsonb_array_elements_text(coalesce(p_input->'collaboratorIds', '[]'::jsonb))), '{}'::uuid[]);
  v_watchers := coalesce(array(select value::text::uuid from jsonb_array_elements_text(coalesce(p_input->'watcherIds', '[]'::jsonb))), '{}'::uuid[]);

  if v_title is null or length(v_title) > 500
     or v_description is null or length(v_description) > 10000
     or v_assignee is null or v_due_date is null or v_due_time is null
     or v_priority not in ('low','normal','high','urgent')
     or jsonb_array_length(v_requirements) < 1 or jsonb_array_length(v_requirements) > 50
     or p_input->>'recurrenceFrequency' is not null
     or p_input->>'recurrenceEndsOn' is not null then
    raise exception 'Invalid assignment input.' using errcode = '22023';
  end if;
  select manager_id into v_manager from public.departments
   where id = v_plan.department_id and active = true;
  if v_manager is null then
    raise exception 'Assignee department requires a primary manager.' using errcode = '22023';
  end if;

  -- The canonical RPC performs assignee, reviewer, department, participant,
  -- status, audit, and notification-compatible Task creation checks.
  v_task := public.api_assign_task_v2(
    p_actor_id, v_title, v_description, v_plan.department_id, v_assignee,
    v_manager, v_due_date, v_due_time, v_requirements::text,
    v_collaborators, v_watchers, null, null, v_priority
  );

  update public.department_plan_items
     set linked_task_id = v_task.id, updated_at = now()
   where id = v_item.id and linked_task_id is null;
  if not found then
    raise exception 'Department plan item was linked concurrently.' using errcode = '40001';
  end if;

  insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data)
  values (p_actor_id, 'department_plan', 'department_plan_items', v_item.id,
          'assign_task_v2', jsonb_build_object('task_id', v_task.id));
  return v_task;
exception
  when invalid_text_representation then
    raise exception 'Invalid assignment input.' using errcode = '22023';
end;
$function$;

revoke all on function public.api_assign_department_plan_task_v2(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.api_assign_department_plan_task_v2(uuid, uuid, jsonb) to service_role;
alter function public.api_assign_department_plan_task_v2(uuid, uuid, jsonb) owner to postgres;

commit;
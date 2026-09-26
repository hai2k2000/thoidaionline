begin;

-- Preserve the source item when a linked Task is deleted; callers must unlink
-- explicitly in a future workflow rather than losing provenance silently.
alter table public.department_plan_items
  drop constraint if exists department_plan_items_linked_task_id_fkey;

alter table public.department_plan_items
  add constraint department_plan_items_linked_task_id_fkey
  foreign key (linked_task_id) references public.tasks(id) on delete restrict;

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
  v_plan public.department_plans;
  v_task public.tasks;
  v_actor_role text;
  v_actor_department uuid;
  v_manager uuid;
  v_due_date date;
  v_due_time time;
begin
  select *
    into v_item
    from public.department_plan_items
   where id = p_item_id
   for update;

  if not found then
    raise exception 'Department plan item not found.' using errcode = 'P0002';
  end if;

  -- Both Plan authority and canonical Task assignment authority are required,
  -- including safe retries for an already-linked item.
  perform public.api_assert_task_action(p_actor_id, null, 'assign');

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

  if v_item.linked_task_id is not null then
    select * into v_task from public.tasks where id = v_item.linked_task_id;
    if found then
      return v_task;
    end if;
    raise exception 'Linked Task not found.' using errcode = 'P0002';
  end if;

  if v_item.assignment_state <> 'assigned' or v_item.assignee_id is null then
    raise exception 'This assignment state cannot create a canonical Task.' using errcode = '22023';
  end if;
  if nullif(btrim(v_item.description), '') is null
     and nullif(btrim(v_item.requirements), '') is null then
    raise exception 'A description or requirement is required to create a Task.' using errcode = '22023';
  end if;
  if v_item.due_at is null then
    raise exception 'A due date is required to create a Task.' using errcode = '22023';
  end if;

  select manager_id
    into v_manager
    from public.departments
   where id = v_plan.department_id
     and active = true;
  if v_manager is null then
    raise exception 'Assignee department requires a primary manager.' using errcode = '22023';
  end if;

  v_due_date := (v_item.due_at at time zone 'Asia/Ho_Chi_Minh')::date;
  v_due_time := (v_item.due_at at time zone 'Asia/Ho_Chi_Minh')::time;

  -- Reuse the canonical assignment RPC so Task authorization, assignee
  -- validation, participants, audit, and default status remain centralized.
  v_task := public.api_assign_task_v2(
    p_actor_id,
    v_item.title,
    coalesce(nullif(btrim(v_item.description), ''), btrim(v_item.requirements)),
    v_plan.department_id,
    v_item.assignee_id,
    v_manager,
    v_due_date,
    v_due_time,
    nullif(btrim(v_item.requirements), ''),
    '{}'::uuid[],
    '{}'::uuid[],
    null,
    null,
    'normal'
  );

  update public.department_plan_items
     set linked_task_id = v_task.id,
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
    'create_task',
    jsonb_build_object('task_id', v_task.id, 'department_plan_id', v_item.department_plan_id)
  );

  return v_task;
end;
$function$;

revoke all on function public.api_create_department_plan_task(uuid, uuid) from public, anon, authenticated;
grant execute on function public.api_create_department_plan_task(uuid, uuid) to service_role;
alter function public.api_create_department_plan_task(uuid, uuid) owner to postgres;

commit;

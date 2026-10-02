begin;

-- Department Plan quick assign records its origin on the normal Task row.
alter table public.tasks drop constraint if exists tasks_assignment_source_check;
alter table public.tasks add constraint tasks_assignment_source_check
  check (assignment_source in ('leadership_assigned','self_registered','legacy_unknown','department_plan'));

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
declare
  v_item public.department_plan_items;
  v_plan public.department_plans;
  v_task public.tasks;
  v_actor_role text;
  v_actor_department uuid;
  v_manager uuid;
  v_description text;
begin
  select * into v_item
    from public.department_plan_items
   where id = p_item_id
   for update;
  if not found then
    raise exception 'Department plan item not found.' using errcode = 'P0002';
  end if;

  if v_item.linked_task_id is not null then
    raise exception 'This department plan item is already assigned.' using errcode = '23505';
  end if;

  perform public.api_assert_task_action(p_actor_id, null, 'assign');

  select r.code, u.department_id
    into v_actor_role, v_actor_department
    from public.staff_users u
    join public.roles r on r.id = u.role_id
   where u.id = p_actor_id
     and u.active = true;
  if v_actor_role is null then
    raise exception 'Invalid actor.' using errcode = '42501';
  end if;

  select * into v_plan
    from public.department_plans
   where id = v_item.department_plan_id
     and department_id = v_item.department_id;
  if not found then
    raise exception 'Department plan not found.' using errcode = 'P0002';
  end if;

  if v_actor_role not in ('admin', 'tong_bien_tap', 'pho_tong_bien_tap')
     and (v_actor_department is null or v_actor_department <> v_plan.department_id) then
    raise exception 'Department plan item is outside actor scope.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.staff_users
     where id = p_assignee_id
       and active = true
       and department_id = v_plan.department_id
  ) then
    raise exception 'Assignee is outside department scope.' using errcode = '42501';
  end if;

  if p_due_date is null or p_due_time is null
     or p_priority not in ('low', 'normal', 'high', 'urgent')
     or p_note is not null and length(p_note) > 2000 then
    raise exception 'Invalid quick assignment input.' using errcode = '22023';
  end if;

  select manager_id into v_manager
    from public.departments
   where id = v_plan.department_id
     and active = true;
  if v_manager is null then
    raise exception 'Assignee department requires a primary manager.' using errcode = '22023';
  end if;

  v_description := nullif(btrim(coalesce(p_note, '')), '');
  if v_description is null then
    v_description := nullif(btrim(coalesce(v_item.description, '')), '');
  end if;
  if v_description is null then
    v_description := nullif(btrim(coalesce(v_item.requirements, '')), '');
  end if;
  v_description := coalesce(v_description, v_item.title);

  v_task := public.api_assign_task_v2(
    p_actor_id,
    v_item.title,
    v_description,
    v_plan.department_id,
    p_assignee_id,
    v_manager,
    p_due_date,
    p_due_time,
    nullif(btrim(v_item.requirements), ''),
    '{}'::uuid[],
    '{}'::uuid[],
    null,
    null,
    p_priority
  );

  if v_task.workflow_type is distinct from 'STANDARD' then
    raise exception 'Department Plan quick assign must create a STANDARD Task.' using errcode = '22023';
  end if;

  update public.tasks
     set assignment_source = 'department_plan', updated_at = now()
   where id = v_task.id
   returning * into v_task;

  update public.department_plan_items
     set linked_task_id = v_task.id,
         assignee_id = p_assignee_id,
         assignment_state = 'assigned',
         due_at = ((p_due_date + p_due_time) at time zone 'Asia/Ho_Chi_Minh'),
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
    'quick_assign_task',
    jsonb_build_object(
      'task_id', v_task.id,
      'department_plan_id', v_item.department_plan_id,
      'assignee_id', p_assignee_id,
      'assigned_at', now()
    )
  );

  return v_task;
exception
  when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then
    raise exception 'Invalid quick assignment input.' using errcode = '22023';
end;
$function$;

revoke all on function public.api_quick_assign_department_plan_task_v1(uuid, uuid, uuid, date, time, text, text) from public, anon, authenticated;
grant execute on function public.api_quick_assign_department_plan_task_v1(uuid, uuid, uuid, date, time, text, text) to service_role;
alter function public.api_quick_assign_department_plan_task_v1(uuid, uuid, uuid, date, time, text, text) owner to postgres;

notify pgrst, 'reload schema';
commit;

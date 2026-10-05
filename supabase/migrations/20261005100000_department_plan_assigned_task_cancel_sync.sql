begin;

-- Department Plan assigned Task cancellation is Admin-only and synchronizes all
-- active/open linked Plan Items in this same transaction.
create or replace function public.api_cancel_assigned_task(
  p_actor_id uuid,
  p_task_id uuid,
  p_reason text
) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_before public.tasks;
  v_after public.tasks;
  v_role_code text;
  v_now timestamptz := now();
  v_item public.department_plan_items;
begin
  select * into v_before
    from public.tasks
   where id = p_task_id
   for update;
  if not found then
    raise exception 'Task not found.' using errcode = 'P0002';
  end if;

  select lower(r.code) into v_role_code
    from public.staff_users u
    join public.roles r on r.id = u.role_id
   where u.id = p_actor_id
     and u.active = true
     and r.active = true;
  if v_role_code is null then
    raise exception 'Invalid task actor.' using errcode = '42501';
  end if;
  if v_before.task_type is distinct from 'assigned'
     or v_before.status = 'cancelled'
     or nullif(btrim(p_reason), '') is null
     or length(p_reason) > 2000 then
    raise exception 'Invalid assigned cancellation.' using errcode = '22023';
  end if;

  if exists (
    select 1
      from public.department_plan_items i
     where i.linked_task_id = p_task_id
  ) and v_role_code <> 'admin' then
    raise exception 'Công việc đã giao từ kế hoạch phòng ban chỉ Admin mới có quyền huỷ.'
      using errcode = '42501';
  end if;

  if v_role_code <> 'admin' and (v_before.created_by is distinct from p_actor_id or v_before.status = 'done') then
    raise exception 'Only the task creator may cancel an assigned task.' using errcode = '42501';
  end if;

  update public.tasks
     set status = 'cancelled',
         cancelled_at = v_now,
         cancelled_by = p_actor_id,
         cancel_reason = btrim(p_reason),
         updated_at = v_now
   where id = p_task_id
   returning * into v_after;

  insert into public.task_status_events(task_id, from_status, to_status, reason, actor_id)
  values (p_task_id, v_before.status, 'cancelled', btrim(p_reason), p_actor_id);

  for v_item in
    select i.*
      from public.department_plan_items i
      join public.department_plans p on p.id = i.department_plan_id
     where i.linked_task_id = p_task_id
       and p.status = 'active'
     for update
  loop
    update public.department_plan_items
       set work_status = 'cancelled',
           close_classification = 'CANCELLED',
           task_status_at_close = 'cancelled',
           period_end_state = 'cancelled',
           completed_in_period = false,
           carry_forward = false,
           updated_at = v_now
     where id = v_item.id;

    insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, old_data, new_data)
    values (
      p_actor_id,
      'department_plan',
      'department_plan_items',
      v_item.id,
      'task_cancel_sync',
      jsonb_build_object(
        'task_id', p_task_id,
        'plan_id', v_item.department_plan_id,
        'plan_item_id', v_item.id,
        'work_status', v_item.work_status,
        'close_classification', v_item.close_classification,
        'carry_forward', v_item.carry_forward
      ),
      jsonb_build_object(
        'task_id', p_task_id,
        'plan_id', v_item.department_plan_id,
        'plan_item_id', v_item.id,
        'work_status', 'cancelled',
        'close_classification', 'CANCELLED',
        'carry_forward', false,
        'reason', btrim(p_reason)
      )
    );
  end loop;

  insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, old_data, new_data)
  values (
    p_actor_id,
    'task',
    'tasks',
    p_task_id,
    'cancel',
    jsonb_build_object('status', v_before.status),
    jsonb_build_object(
      'status', 'cancelled',
      'reason', btrim(p_reason),
      'department_plan_synchronized', exists (
        select 1 from public.department_plan_items where linked_task_id = p_task_id
      )
    )
  );

  return v_after;
end
$function$;

revoke all on function public.api_cancel_assigned_task(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.api_cancel_assigned_task(uuid,uuid,text) to service_role;
alter function public.api_cancel_assigned_task(uuid,uuid,text) owner to postgres;
notify pgrst, 'reload schema';
commit;

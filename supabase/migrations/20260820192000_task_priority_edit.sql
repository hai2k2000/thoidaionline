begin;
create or replace function public.api_update_task(
  p_actor_id uuid,
  p_task_id uuid,
  p_status text default null,
  p_due_date date default null,
  p_update_due_date boolean default false,
  p_priority text default null,
  p_update_priority boolean default false
)
returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_before public.tasks; v_after public.tasks;
begin
  perform public.api_assert_task_action(p_actor_id,p_task_id,'update');
  select * into v_before from public.tasks where id=p_task_id;
  if p_status is not null and p_status not in ('new','in_progress') then
    raise exception 'Use report/review for completion transitions.' using errcode='22023';
  end if;
  if p_update_priority and p_priority not in ('low','normal','high','urgent') then
    raise exception 'Invalid task priority.' using errcode='22023';
  end if;
  if p_status is null and not p_update_due_date and not p_update_priority then
    raise exception 'No update supplied.' using errcode='22023';
  end if;
  update public.tasks set
    status=coalesce(p_status,status),
    due_date=case when p_update_due_date then p_due_date else due_date end,
    priority=case when p_update_priority then p_priority else priority end,
    updated_at=now()
  where id=p_task_id returning * into v_after;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor_id,'task','tasks',p_task_id,'update',
    jsonb_build_object('status',v_before.status,'due_date',v_before.due_date,'priority',v_before.priority),
    jsonb_build_object('status',v_after.status,'due_date',v_after.due_date,'priority',v_after.priority));
  return v_after;
end
$function$;
revoke all on function public.api_update_task(uuid,uuid,text,date,boolean,text,boolean) from public,anon,authenticated;
grant execute on function public.api_update_task(uuid,uuid,text,date,boolean,text,boolean) to service_role;
alter function public.api_update_task(uuid,uuid,text,date,boolean,text,boolean) owner to postgres;
commit;

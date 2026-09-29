begin;

create or replace function public.api_change_personal_task_deadline(
  p_actor_id uuid,
  p_task_id uuid,
  p_new_due_date date,
  p_reason text
) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_before public.tasks; v_after public.tasks;
begin
  v_before := public.api_assert_personal_task_owner(p_actor_id,p_task_id,true);
  if v_before.status in ('done','cancelled')
     and not exists(select 1 from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor_id and r.code='admin') then
    raise exception 'Approved or cancelled task cannot be edited.' using errcode='42501';
  end if;
  if p_new_due_date is null or p_new_due_date<v_before.start_date
     or p_new_due_date is not distinct from v_before.due_date
     or nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then
    raise exception 'Invalid deadline change.' using errcode='22023';
  end if;
  update public.tasks set due_date=p_new_due_date,updated_at=now()
  where id=p_task_id returning * into v_after;
  insert into public.task_deadline_history(task_id,old_due_date,new_due_date,reason,changed_by)
  values(p_task_id,v_before.due_date,p_new_due_date,btrim(p_reason),p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor_id,'task','tasks',p_task_id,'deadline_change',jsonb_build_object('due_date',v_before.due_date),jsonb_build_object('due_date',p_new_due_date,'reason',btrim(p_reason)));
  return v_after;
end
$function$;

revoke all on function public.api_change_personal_task_deadline(uuid,uuid,date,text) from public,anon,authenticated;
grant execute on function public.api_change_personal_task_deadline(uuid,uuid,date,text) to service_role;
alter function public.api_change_personal_task_deadline(uuid,uuid,date,text) owner to postgres;
notify pgrst,'reload schema';
commit;

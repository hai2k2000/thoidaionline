begin;

-- Keep admin edits from bypassing the canonical assigned-task completion flow.
create or replace function public.api_admin_edit_task(
  p_actor_id uuid,p_task_id uuid,p_title text,p_description text,
  p_start_date date,p_due_date date,p_due_time time,p_priority text,
  p_status text,p_evaluation_criteria text,p_reason text
) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_before public.tasks; v_after public.tasks;
begin
  if not exists(
    select 1 from public.staff_users u
    join public.roles r on r.id=u.role_id
    where u.id=p_actor_id and u.active and r.active and r.code='admin'
  ) then
    raise exception 'Admin task edit forbidden.' using errcode='42501';
  end if;
  select * into v_before from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
  if nullif(btrim(p_title),'') is null or length(p_title)>500
     or nullif(btrim(p_description),'') is null or length(p_description)>10000
     or p_start_date is null or p_due_date is null or p_start_date>p_due_date
     or p_priority not in ('low','normal','high','urgent')
     or p_status not in ('new','in_progress','blocked','waiting','pending_review','done','rejected','cancelled')
     or length(coalesce(p_evaluation_criteria,''))>10000
     or nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then
    raise exception 'Invalid admin task edit.' using errcode='22023';
  end if;

  if v_before.task_type='assigned'
     and coalesce(v_before.task_category,'regular')<>'duty'
     and p_status='pending_review'
     and v_before.status is distinct from 'pending_review' then
    raise exception 'Assigned completion must be submitted by the assignee.' using errcode='22023';
  end if;
  if v_before.task_type='assigned'
     and coalesce(v_before.task_category,'regular')<>'duty'
     and p_status='done'
     and v_before.status is distinct from 'done'
     and (v_before.status<>'pending_review'
       or v_before.completion_submitted_at is null
       or not exists (
         select 1 from public.task_completion_scores s
         where s.task_id=p_task_id
           and s.updated_at>=v_before.completion_submitted_at
       )) then
    raise exception 'Công việc phải được gửi và chấm điểm cho lần hiện tại trước khi hoàn thành.' using errcode='22023';
  end if;

  update public.tasks set
    title=btrim(p_title),description=btrim(p_description),start_date=p_start_date,
    due_date=p_due_date,due_time=p_due_time,priority=p_priority,status=p_status,
    progress_percent=case when p_status='done' then 100 else progress_percent end,
    evaluation_criteria=nullif(btrim(p_evaluation_criteria),''),
    completion_submitted_at=case
      when p_status='done' then coalesce(completion_submitted_at,now())
      when v_before.task_type='assigned' and coalesce(v_before.task_category,'regular')<>'duty' then null
      else completion_submitted_at
    end,
    completed_at=case when p_status='done' then coalesce(completed_at,now()) else null end,
    cancelled_at=case when p_status='cancelled' then coalesce(cancelled_at,now()) else null end,
    cancelled_by=case when p_status='cancelled' then p_actor_id else null end,
    cancel_reason=case when p_status='cancelled' then btrim(p_reason) else null end,
    updated_at=now()
  where id=p_task_id returning * into v_after;

  if v_before.status='done' and p_status<>'done'
     and v_before.task_type='assigned'
     and coalesce(v_before.task_category,'regular')<>'duty' then
    delete from public.task_completion_scores where task_id=p_task_id;
  end if;
  if v_before.due_date is distinct from p_due_date then
    insert into public.task_deadline_history(task_id,old_due_date,new_due_date,reason,changed_by)
    values(p_task_id,v_before.due_date,p_due_date,btrim(p_reason),p_actor_id);
  end if;
  if v_before.status is distinct from p_status then
    insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id)
    values(p_task_id,v_before.status,p_status,btrim(p_reason),p_actor_id);
  end if;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor_id,'task','tasks',p_task_id,'admin_edit',to_jsonb(v_before),to_jsonb(v_after)||jsonb_build_object('reason',btrim(p_reason)));
  return v_after;
end
$function$;

revoke all on function public.api_admin_edit_task(uuid,uuid,text,text,date,date,time,text,text,text,text) from public,anon,authenticated;
grant execute on function public.api_admin_edit_task(uuid,uuid,text,text,date,date,time,text,text,text,text) to service_role;
alter function public.api_admin_edit_task(uuid,uuid,text,text,date,date,time,text,text,text,text) owner to postgres;

commit;

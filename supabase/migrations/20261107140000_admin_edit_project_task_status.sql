begin;

-- Extend the admin edit contract with an atomic stale-write check while keeping
-- the historical signatures available to older callers.
create or replace function public.api_admin_edit_task_unchecked(
  p_actor_id uuid,p_task_id uuid,p_title text,p_description text,p_start_date date,
  p_due_date date,p_due_time time,p_priority text,p_status text,
  p_evaluation_criteria text,p_reason text
) returns public.tasks language plpgsql security definer set search_path=public,pg_temp
as $function$
begin
  return public.api_admin_edit_task_unchecked(p_actor_id,p_task_id,p_title,p_description,
    p_start_date,p_due_date,p_due_time,p_priority,p_status,p_evaluation_criteria,p_reason,
    null::timestamptz,false);
end
$function$;

create or replace function public.api_admin_edit_task_unchecked(
  p_actor_id uuid,p_task_id uuid,p_title text,p_description text,p_start_date date,
  p_due_date date,p_due_time time,p_priority text,p_status text,
  p_evaluation_criteria text,p_reason text,p_expected_updated_at timestamptz,
  p_status_unchanged boolean
) returns public.tasks language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_before public.tasks; v_after public.tasks; v_status text;
begin
  if not exists(select 1 from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor_id and u.active and r.active and r.code='admin') then raise exception 'Admin task edit forbidden.' using errcode='42501'; end if;
  select * into v_before from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
  if p_expected_updated_at is not null and v_before.updated_at is distinct from p_expected_updated_at then
    raise exception 'Task changed while editing.' using errcode='40001', hint='admin_edit.task_changed', detail=v_before.status;
  end if;
  v_status:=case when coalesce(p_status_unchanged,false) then v_before.status else p_status end;
  if nullif(btrim(p_title),'') is null or length(p_title)>500 then raise exception 'Invalid admin edit title.' using errcode='22023', hint='admin_edit.title'; end if;
  if nullif(btrim(p_description),'') is null or length(p_description)>10000 then raise exception 'Invalid admin edit description.' using errcode='22023', hint='admin_edit.description'; end if;
  if p_start_date is null then raise exception 'Invalid admin edit start date.' using errcode='22023', hint='admin_edit.start_date'; end if;
  if p_due_date is not null and p_start_date>p_due_date then raise exception 'Invalid admin edit due date.' using errcode='22023', hint='admin_edit.due_date'; end if;
  if p_due_date is null and p_due_time is not null then raise exception 'Invalid admin edit due time.' using errcode='22023', hint='admin_edit.due_time'; end if;
  if p_priority is null or p_priority not in ('low','normal','high','urgent') then raise exception 'Invalid admin edit priority.' using errcode='22023', hint='admin_edit.priority'; end if;
  if v_status is null or v_status not in ('new','in_progress','blocked','waiting','pending_review','done','rejected','cancelled') then raise exception 'Invalid admin edit status.' using errcode='22023', hint='admin_edit.status'; end if;
  if length(coalesce(p_evaluation_criteria,''))>10000 then raise exception 'Invalid admin edit requirements.' using errcode='22023', hint='admin_edit.requirements'; end if;
  if nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then raise exception 'Invalid admin edit reason.' using errcode='22023', hint='admin_edit.reason'; end if;
  if v_before.task_type='assigned' and coalesce(v_before.task_category,'regular')<>'duty' and v_status='pending_review' and v_before.status is distinct from 'pending_review' then raise exception 'Assigned completion must be submitted by the assignee.' using errcode='22023', hint='admin_edit.status_requires_submission'; end if;
  if v_before.task_type='assigned' and coalesce(v_before.task_category,'regular')<>'duty' and v_before.project_id is null and v_status='done' and v_before.status is distinct from 'done' and (v_before.status<>'pending_review' or v_before.completion_submitted_at is null or not exists(select 1 from public.task_completion_scores s where s.task_id=p_task_id and s.updated_at>=v_before.completion_submitted_at)) then raise exception 'Task must be submitted and scored before completion.' using errcode='22023', hint='admin_edit.status_requires_score'; end if;
  update public.tasks set title=btrim(p_title),description=btrim(p_description),start_date=p_start_date,due_date=p_due_date,due_time=case when p_due_date is null then null else p_due_time end,priority=p_priority,status=v_status,progress_percent=case when v_status='done' then 100 else progress_percent end,evaluation_criteria=p_evaluation_criteria,completion_submitted_at=case when v_status='done' then coalesce(completion_submitted_at,now()) when v_before.task_type='assigned' and coalesce(v_before.task_category,'regular')<>'duty' and v_before.project_id is null then null else completion_submitted_at end,completed_at=case when v_status='done' then coalesce(completed_at,now()) else null end,cancelled_at=case when v_status='cancelled' then coalesce(cancelled_at,now()) else null end,cancelled_by=case when v_status='cancelled' then p_actor_id else null end,cancel_reason=case when v_status='cancelled' then btrim(p_reason) else null end,updated_at=now() where id=p_task_id returning * into v_after;
  if v_before.status='done' and v_status<>'done' and v_before.task_type='assigned' and coalesce(v_before.task_category,'regular')<>'duty' and v_before.project_id is null then delete from public.task_completion_scores where task_id=p_task_id; end if;
  if v_before.due_date is distinct from p_due_date then insert into public.task_deadline_history(task_id,old_due_date,new_due_date,reason,changed_by) values(p_task_id,v_before.due_date,p_due_date,btrim(p_reason),p_actor_id); end if;
  if v_before.status is distinct from v_status then insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id) values(p_task_id,v_before.status,v_status,btrim(p_reason),p_actor_id); end if;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values(p_actor_id,'task','tasks',p_task_id,'admin_edit',to_jsonb(v_before),to_jsonb(v_after)||jsonb_build_object('reason',btrim(p_reason)));
  return v_after;
end
$function$;

create or replace function public.api_admin_edit_task(
  p_actor_id uuid,p_task_id uuid,p_title text,p_description text,p_start_date date,p_due_date date,p_due_time time,p_priority text,p_status text,p_evaluation_criteria text,p_reason text,p_expected_updated_at timestamptz,p_status_unchanged boolean
) returns public.tasks language plpgsql security definer set search_path=public,pg_temp
as $function$
begin
  perform public.api_assert_task_creator_mutation(p_actor_id,p_task_id,'edit');
  return public.api_admin_edit_task_unchecked(p_actor_id,p_task_id,p_title,p_description,p_start_date,p_due_date,p_due_time,p_priority,p_status,p_evaluation_criteria,p_reason,p_expected_updated_at,p_status_unchanged);
end
$function$;

create or replace function public.api_admin_set_task_participants(
  p_actor_id uuid,p_task_id uuid,p_assignee_id uuid,p_collaborator_ids uuid[],p_watcher_ids uuid[],p_reviewer_id uuid,p_reason text,p_expected_updated_at timestamptz
) returns public.tasks language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_task public.tasks;
begin
  v_task:=public.api_assert_task_creator_mutation(p_actor_id,p_task_id,'edit');
  if p_expected_updated_at is not null and v_task.updated_at is distinct from p_expected_updated_at then raise exception 'Task changed while editing.' using errcode='40001', hint='admin_edit.task_changed', detail=v_task.status; end if;
  return public.api_admin_set_task_participants(p_actor_id,p_task_id,p_assignee_id,p_collaborator_ids,p_watcher_ids,p_reviewer_id,p_reason);
end
$function$;

revoke all on function public.api_admin_edit_task_unchecked(uuid,uuid,text,text,date,date,time,text,text,text,text) from public,anon,authenticated,service_role;
revoke all on function public.api_admin_edit_task_unchecked(uuid,uuid,text,text,date,date,time,text,text,text,text,timestamptz,boolean) from public,anon,authenticated,service_role;
revoke all on function public.api_admin_edit_task(uuid,uuid,text,text,date,date,time,text,text,text,text) from public,anon,authenticated;
revoke all on function public.api_admin_edit_task(uuid,uuid,text,text,date,date,time,text,text,text,text,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.api_admin_edit_task(uuid,uuid,text,text,date,date,time,text,text,text,text) to service_role;
grant execute on function public.api_admin_edit_task(uuid,uuid,text,text,date,date,time,text,text,text,text,timestamptz,boolean) to service_role;
revoke all on function public.api_admin_set_task_participants(uuid,uuid,uuid,uuid[],uuid[],uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.api_admin_set_task_participants(uuid,uuid,uuid,uuid[],uuid[],uuid,text,timestamptz) to service_role;
alter function public.api_admin_edit_task_unchecked(uuid,uuid,text,text,date,date,time,text,text,text,text) owner to postgres;
alter function public.api_admin_edit_task_unchecked(uuid,uuid,text,text,date,date,time,text,text,text,text,timestamptz,boolean) owner to postgres;
alter function public.api_admin_edit_task(uuid,uuid,text,text,date,date,time,text,text,text,text) owner to postgres;
alter function public.api_admin_edit_task(uuid,uuid,text,text,date,date,time,text,text,text,text,timestamptz,boolean) owner to postgres;
alter function public.api_admin_set_task_participants(uuid,uuid,uuid,uuid[],uuid[],uuid,text,timestamptz) owner to postgres;
notify pgrst,'reload schema';
commit;

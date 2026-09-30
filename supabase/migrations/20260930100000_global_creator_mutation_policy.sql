begin;

alter table public.work_schedules drop constraint if exists work_schedules_approval_status_check;
alter table public.work_schedules add constraint work_schedules_approval_status_check check (approval_status = any (array['PENDING_APPROVAL','APPROVED','REJECTED','CANCELLED']));

create or replace function public.api_assert_creator_mutation(
  p_actor uuid,
  p_created_by uuid,
  p_lifecycle_state text,
  p_action text
) returns void
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_role text;
begin
  if p_action not in ('edit','cancel')
     or p_lifecycle_state not in ('PENDING','APPROVED','CANCELLED')
     or p_created_by is null then
    raise exception 'mutation policy unavailable' using errcode='42501';
  end if;
  select lower(r.code) into v_role
  from public.staff_users u join public.roles r on r.id=u.role_id
  where u.id=p_actor and u.active=true and r.active=true;
  if v_role is null or p_lifecycle_state='CANCELLED'
     or (p_lifecycle_state='APPROVED' and v_role<>'admin')
     or (p_lifecycle_state='PENDING' and v_role<>'admin' and p_actor is distinct from p_created_by) then
    raise exception 'creator mutation forbidden' using errcode='42501';
  end if;
end
$function$;

create or replace function public.api_cancel_leave_request(p_actor uuid,p_request_id uuid)
returns public.leave_requests language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_row public.leave_requests; v_old public.leave_requests; v_role text; v_state text;
begin
  select r.code into v_role from public.staff_users u join public.roles r on r.id=u.role_id
    where u.id=p_actor and u.active=true and r.active=true;
  select * into v_old from public.leave_requests where id=p_request_id for update;
  if not found then raise exception 'leave request unavailable' using errcode='40001'; end if;
  v_state := case v_old.status when 'approved' then 'APPROVED' when 'cancelled' then 'CANCELLED' else 'PENDING' end;
  perform public.api_assert_creator_mutation(p_actor,v_old.requester_id,v_state,'cancel');
  update public.leave_requests set status='cancelled',updated_at=now() where id=p_request_id returning * into v_row;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor,'admin','leave_requests',v_row.id,'cancel_leave_request',to_jsonb(v_old),to_jsonb(v_row));
  return v_row;
end $function$;

create or replace function public.api_edit_leave_request(
  p_actor uuid,p_request_id uuid,p_start_date date,p_end_date date,
  p_start_period text,p_end_period text,p_leave_type text,p_reason text
) returns public.leave_requests language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_row public.leave_requests; v_old public.leave_requests; v_state text;
begin
  select * into v_old from public.leave_requests where id=p_request_id for update;
  if not found then raise exception 'leave request unavailable' using errcode='40001'; end if;
  v_state := case v_old.status when 'approved' then 'APPROVED' when 'cancelled' then 'CANCELLED' else 'PENDING' end;
  perform public.api_assert_creator_mutation(p_actor,v_old.requester_id,v_state,'edit');
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date
     or p_start_period not in ('full','morning','afternoon')
     or p_end_period not in ('full','morning','afternoon')
     or p_leave_type not in ('annual','sick','unpaid','personal','business')
     or length(trim(coalesce(p_reason,''))) not between 3 and 1000
     or (p_start_date=p_end_date and p_start_period<>'full' and p_end_period<>p_start_period) then
    raise exception 'invalid leave request' using errcode='22023';
  end if;
  update public.leave_requests set start_date=p_start_date,end_date=p_end_date,
    start_period=p_start_period,end_period=p_end_period,leave_type=p_leave_type,
    reason=trim(p_reason),updated_at=now()
  where id=p_request_id returning * into v_row;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor,'admin','leave_requests',v_row.id,'edit_leave_request',to_jsonb(v_old),to_jsonb(v_row));
  return v_row;
end $function$;

create or replace function public.api_cancel_personal_work_schedule(
  p_actor uuid,p_id uuid,p_expected_revision bigint
) returns public.work_schedules
language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_old public.work_schedules; v_row public.work_schedules; v_role text;
begin
  select r.code into v_role from public.staff_users u join public.roles r on r.id=u.role_id
    where u.id=p_actor and u.active=true and r.active=true;
  select * into v_old from public.work_schedules where id=p_id for update;
  if not found or v_old.schedule_scope is distinct from 'personal' then raise exception 'personal plan unavailable' using errcode='P0002'; end if;
  if p_expected_revision is null or p_expected_revision<>v_old.workflow_revision then raise exception 'stale personal plan' using errcode='40001'; end if;
  perform public.api_assert_creator_mutation(
    p_actor,v_old.created_by,
    case v_old.approval_status when 'APPROVED' then 'APPROVED' when 'CANCELLED' then 'CANCELLED' else 'PENDING' end,
    'cancel');
  update public.work_schedules set approval_status='CANCELLED',
    workflow_revision=workflow_revision+1,updated_at=now() where id=p_id returning * into v_row;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor,'admin','work_schedules',v_row.id,'cancel_personal_plan',to_jsonb(v_old),to_jsonb(v_row));
  return v_row;
end $function$;

revoke all on function public.api_assert_creator_mutation(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.api_assert_creator_mutation(uuid,uuid,text,text) to service_role;
revoke all on function public.api_edit_leave_request(uuid,uuid,date,date,text,text,text,text) from public,anon,authenticated;
grant execute on function public.api_edit_leave_request(uuid,uuid,date,date,text,text,text,text) to service_role;
revoke all on function public.api_cancel_personal_work_schedule(uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.api_cancel_personal_work_schedule(uuid,uuid,bigint) to service_role;
revoke all on function public.api_cancel_leave_request(uuid,uuid) from public,anon,authenticated;
grant execute on function public.api_cancel_leave_request(uuid,uuid) to service_role;

CREATE OR REPLACE FUNCTION public.api_create_personal_work_schedule(p_actor uuid, p_id uuid, p_work_date date, p_end_date date, p_plan_type text, p_start_time time without time zone, p_end_time time without time zone, p_title text, p_location text, p_notes text, p_participant_ids uuid[], p_expected_revision bigint DEFAULT NULL::bigint)
 RETURNS work_schedules
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_row public.work_schedules;
  v_old public.work_schedules;
  v_department uuid;
  v_manager uuid;
  v_role text;
  v_material boolean;
  v_scope text;
  v_status text;
  v_action text;
  v_revision bigint;
  v_owner uuid;
begin
  select u.department_id, lower(r.code)
  into v_department, v_role
  from public.staff_users u
  join public.roles r on r.id=u.role_id
  where u.id=p_actor and u.active=true;
  if not found then
    raise exception 'forbidden' using errcode='42501';
  end if;

  if p_work_date is null or p_end_date is null or p_end_date < p_work_date
     or p_plan_type not in ('work','business','event')
     or p_start_time is null or p_end_time is null
     or (p_work_date = p_end_date and p_end_time <= p_start_time)
     or length(trim(coalesce(p_title,''))) not between 1 and 500
     or coalesce(array_length(p_participant_ids, 1), 0) > 50 then
    raise exception 'invalid personal plan' using errcode='22023';
  end if;

  select d.manager_id into v_manager
  from public.departments d
  left join public.staff_users manager on manager.id=d.manager_id and manager.active=true
  where d.id=v_department and d.active=true;
  if v_manager is not null and not exists (select 1 from public.staff_users where id=v_manager and active=true) then
    v_manager := null;
  end if;

  if p_id is null then
    if p_participant_ids is distinct from array[p_actor]::uuid[] then
      raise exception 'personal plans may only include the creator' using errcode='42501';
    end if;
    insert into public.work_schedules(
      work_date,end_date,plan_type,start_time,end_time,title,location,notes,
      participant_ids,created_by,schedule_scope,approval_status,approver_id,
      submitted_at,workflow_revision,updated_at
    ) values (
      p_work_date,p_end_date,p_plan_type,p_start_time,p_end_time,trim(p_title),
      nullif(trim(p_location),''),nullif(trim(p_notes),''),
      array[p_actor]::uuid[],p_actor,'personal','PENDING_APPROVAL',
      v_manager,now(),1,now()
    ) returning * into v_row;
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
    values(p_actor,'admin','work_schedules',v_row.id,'create_personal_plan',to_jsonb(v_row));
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
    values(p_actor,'admin','work_schedules',v_row.id,'submit_personal_plan',to_jsonb(v_row));
    return v_row;
  end if;

  select * into v_old
  from public.work_schedules
  where id=p_id
  for update;
  if not found then
    raise exception 'personal plan unavailable' using errcode='P0002';
  end if;
  if v_old.created_by <> p_actor and v_role <> 'admin' then
    raise exception 'forbidden' using errcode='42501';
  end if;
  v_owner := v_old.created_by;
  select department_id into v_department
  from public.staff_users
  where id=v_owner and active=true;
  select d.manager_id into v_manager
  from public.departments d
  left join public.staff_users manager on manager.id=d.manager_id and manager.active=true
  where d.id=v_department and d.active=true;
  if v_old.schedule_scope = 'organization' then
    raise exception 'forbidden' using errcode='42501';
  end if;
  perform public.api_assert_creator_mutation(
    p_actor,
    v_old.created_by,
    case v_old.approval_status when 'APPROVED' then 'APPROVED' when 'CANCELLED' then 'CANCELLED' else 'PENDING' end,
    'edit'
  );
  if p_expected_revision is null or p_expected_revision <> v_old.workflow_revision then
    raise exception 'stale personal plan' using errcode='40001';
  end if;

  v_material := v_old.work_date is distinct from p_work_date
    or v_old.end_date is distinct from p_end_date
    or v_old.plan_type is distinct from p_plan_type
    or v_old.start_time is distinct from p_start_time
    or v_old.end_time is distinct from p_end_time
    or v_old.title is distinct from trim(p_title)
    or v_old.location is distinct from nullif(trim(p_location),'')
    or v_old.notes is distinct from nullif(trim(p_notes),'')
    or v_old.participant_ids is distinct from array[v_owner]::uuid[];

  v_scope := 'personal';
  v_status := v_old.approval_status;
  v_action := 'edit_personal_plan';
  if v_material and v_old.approval_status = 'REJECTED' then
    v_status := 'PENDING_APPROVAL';
    v_action := case when v_old.schedule_scope is null then 'promote_legacy_personal_plan' else 'submit_personal_plan' end;
  elsif v_old.schedule_scope is null then
    v_action := 'promote_legacy_personal_plan';
  end if;
  v_revision := v_old.workflow_revision + 1;

  update public.work_schedules
  set work_date=p_work_date,end_date=p_end_date,plan_type=p_plan_type,
      start_time=p_start_time,end_time=p_end_time,title=trim(p_title),
      location=nullif(trim(p_location),''),notes=nullif(trim(p_notes),''),
      participant_ids=array[v_owner]::uuid[],schedule_scope=v_scope,
      approval_status=v_status,
      approver_id=case when v_status='PENDING_APPROVAL' then v_manager else v_old.approver_id end,
      submitted_at=case when v_status='PENDING_APPROVAL' then now() else v_old.submitted_at end,
      reviewed_by=case when v_status='PENDING_APPROVAL' then null else v_old.reviewed_by end,
      reviewed_at=case when v_status='PENDING_APPROVAL' then null else v_old.reviewed_at end,
      review_note=case when v_status='PENDING_APPROVAL' then null else v_old.review_note end,
      workflow_revision=v_revision,updated_at=now()
  where id=p_id
  returning * into v_row;

  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor,'admin','work_schedules',v_row.id,v_action,to_jsonb(v_old),to_jsonb(v_row));
  return v_row;
end $function$;

commit;
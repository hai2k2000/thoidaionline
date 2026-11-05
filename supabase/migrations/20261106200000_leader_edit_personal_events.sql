begin;

-- Preserve the existing RPC signature, owner and ACLs through CREATE OR REPLACE.
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
  v_actor_department uuid;
  v_job text;
  v_global boolean;
  v_department_head boolean;
  v_leader_edit boolean;
begin
  select u.department_id, lower(r.code), lower(coalesce(j.code,''))
  into v_department, v_role, v_job
  from public.staff_users u
  join public.roles r on r.id=u.role_id
  left join public.job_titles j on j.id=u.job_title_id
  where u.id=p_actor and u.active=true and r.active=true;
  if not found then
    raise exception 'forbidden' using errcode='42501';
  end if;

  v_actor_department := v_department;
  v_global := v_role in ('admin','tong_bien_tap','pho_tong_bien_tap');
  v_department_head := v_role='truong_phong' or starts_with(v_job,'truong_phong')
    or exists(select 1 from public.departments d where d.manager_id=p_actor);

  if p_work_date is null or p_end_date is null or p_end_date < p_work_date
     or p_plan_type not in ('work','business','event')
     or p_start_time is null or p_end_time is null
     or (p_work_date = p_end_date and p_end_time <= p_start_time)
     or length(trim(coalesce(p_title,''))) not between 1 and 500
     or coalesce(cardinality(p_participant_ids), 0) not between 1 and 50
     or (select count(distinct member) from unnest(p_participant_ids) member) <> cardinality(p_participant_ids) then
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
  v_owner := v_old.created_by;
  select department_id into v_department
  from public.staff_users
  where id=v_owner;
  select d.manager_id into v_manager
  from public.departments d
  left join public.staff_users manager on manager.id=d.manager_id and manager.active=true
  where d.id=v_department and d.active=true;
  if v_old.schedule_scope = 'organization' then
    raise exception 'forbidden' using errcode='42501';
  end if;
  v_leader_edit := coalesce(v_old.schedule_scope='personal'
    and v_old.approval_status in ('PENDING_APPROVAL','APPROVED','REJECTED')
    and (v_global or (v_department_head and v_actor_department is not null and v_department=v_actor_department)), false);
  if not v_leader_edit then
    perform public.api_assert_creator_mutation(
      p_actor,
      v_old.created_by,
      case v_old.approval_status when 'APPROVED' then 'APPROVED' when 'CANCELLED' then 'CANCELLED' else 'PENDING' end,
      'edit'
    );
  end if;

  if v_leader_edit then
    -- Validate every submitted member; stale/out-of-scope members must be removed explicitly.
    if exists (
      select 1 from unnest(p_participant_ids) member
      where not exists (
        select 1 from public.staff_users s join public.roles r on r.id=s.role_id
        where s.id=member and s.active=true
          and lower(trim(coalesce(r.code,''))) not in ('admin','cong_tac_vien')
          and lower(trim(coalesce(s.username,''))) <> 'admin'
          and lower(trim(coalesce(s.full_name,''))) <> 'admin'
          and (v_global or s.department_id=v_actor_department)
      )
    ) then raise exception 'forbidden participant' using errcode='42501'; end if;
  elsif not (p_participant_ids <@ coalesce(v_old.participant_ids,array[v_owner]::uuid[])) then
    raise exception 'personal plan participant change forbidden' using errcode='42501';
  end if;
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
    or v_old.participant_ids is distinct from p_participant_ids;

  v_scope := 'personal';
  v_status := v_old.approval_status;
  v_action := 'edit_personal_plan';
  if not v_leader_edit and v_material and v_old.approval_status = 'REJECTED' then
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
      participant_ids=p_participant_ids,schedule_scope=v_scope,
      approval_status=v_status,
      approver_id=case when not v_leader_edit and v_status='PENDING_APPROVAL' then v_manager else v_old.approver_id end,
      submitted_at=case when not v_leader_edit and v_status='PENDING_APPROVAL' then now() else v_old.submitted_at end,
      reviewed_by=case when not v_leader_edit and v_status='PENDING_APPROVAL' then null else v_old.reviewed_by end,
      reviewed_at=case when not v_leader_edit and v_status='PENDING_APPROVAL' then null else v_old.reviewed_at end,
      review_note=case when not v_leader_edit and v_status='PENDING_APPROVAL' then null else v_old.review_note end,
      workflow_revision=v_revision,updated_at=now()
  where id=p_id
  returning * into v_row;

  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor,'admin','work_schedules',v_row.id,v_action,to_jsonb(v_old),to_jsonb(v_row));
  return v_row;
end $function$;

revoke all on function public.api_create_personal_work_schedule(uuid,uuid,date,date,text,time without time zone,time without time zone,text,text,text,uuid[],bigint) from public,anon,authenticated;
grant execute on function public.api_create_personal_work_schedule(uuid,uuid,date,date,text,time without time zone,time without time zone,text,text,text,uuid[],bigint) to service_role;

commit;

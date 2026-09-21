begin;

alter table public.work_schedules
  add column if not exists schedule_scope text,
  add column if not exists approval_status text,
  add column if not exists approver_id uuid references public.staff_users(id),
  add column if not exists reviewed_by uuid references public.staff_users(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text,
  add column if not exists submitted_at timestamptz,
  add column if not exists workflow_revision bigint;

update public.work_schedules
set approval_status = 'APPROVED'
where approval_status is null;

update public.work_schedules
set workflow_revision = 0
where workflow_revision is null;

alter table public.work_schedules
  alter column approval_status set default 'APPROVED',
  alter column approval_status set not null,
  alter column workflow_revision set default 0,
  alter column workflow_revision set not null;

alter table public.work_schedules
  drop constraint if exists work_schedules_schedule_scope_check,
  drop constraint if exists work_schedules_approval_status_check,
  drop constraint if exists work_schedules_workflow_revision_check;

alter table public.work_schedules
  add constraint work_schedules_schedule_scope_check
    check (schedule_scope is null or schedule_scope in ('personal', 'organization')),
  add constraint work_schedules_approval_status_check
    check (approval_status in ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
  add constraint work_schedules_workflow_revision_check
    check (workflow_revision >= 0);

create index if not exists work_schedules_scope_status_date_idx
  on public.work_schedules(schedule_scope, approval_status, work_date, end_date);
create index if not exists work_schedules_creator_scope_updated_idx
  on public.work_schedules(created_by, schedule_scope, updated_at desc);
create index if not exists work_schedules_approver_status_updated_idx
  on public.work_schedules(approver_id, approval_status, updated_at desc);

create or replace function public.api_create_personal_work_schedule(
  p_actor uuid,
  p_id uuid,
  p_work_date date,
  p_end_date date,
  p_plan_type text,
  p_start_time time,
  p_end_time time,
  p_title text,
  p_location text,
  p_notes text,
  p_participant_ids uuid[],
  p_expected_revision bigint default null
) returns public.work_schedules
language plpgsql security definer set search_path=public,pg_temp as $function$
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
  if v_old.schedule_scope = 'organization' then
    raise exception 'forbidden' using errcode='42501';
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
    or v_old.participant_ids is distinct from array[v_owner]::uuid[];

  v_scope := 'personal';
  v_status := v_old.approval_status;
  v_action := 'edit_personal_plan';
  if v_material and v_old.approval_status in ('APPROVED','REJECTED') then
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

create or replace function public.api_review_personal_work_schedule(
  p_actor uuid,
  p_id uuid,
  p_action text,
  p_note text,
  p_expected_revision bigint
) returns public.work_schedules
language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_row public.work_schedules;
  v_old public.work_schedules;
  v_role text;
  v_actor_department uuid;
  v_creator_department uuid;
  v_manager uuid;
  v_status text;
begin
  if p_action not in ('approve','reject') or p_expected_revision is null
     or (p_action='reject' and length(trim(coalesce(p_note,''))) not between 3 and 1000)
     or (p_action='approve' and length(coalesce(p_note,'')) > 1000) then
    raise exception 'invalid review' using errcode='22023';
  end if;

  select u.department_id, lower(r.code)
  into v_actor_department, v_role
  from public.staff_users u
  join public.roles r on r.id=u.role_id
  where u.id=p_actor and u.active=true;
  if not found then
    raise exception 'forbidden' using errcode='42501';
  end if;

  select * into v_old from public.work_schedules where id=p_id for update;
  if not found then
    raise exception 'personal plan unavailable' using errcode='P0002';
  end if;
  if v_old.schedule_scope <> 'personal' or v_old.approval_status <> 'PENDING_APPROVAL'
     or v_old.workflow_revision <> p_expected_revision then
    raise exception 'personal plan is stale or not pending' using errcode='40001';
  end if;
  if v_old.created_by = p_actor then
    raise exception 'forbidden' using errcode='42501';
  end if;

  select department_id into v_creator_department
  from public.staff_users where id=v_old.created_by and active=true;
  select d.manager_id into v_manager
  from public.departments d
  join public.staff_users manager on manager.id=d.manager_id and manager.active=true
  where d.id=v_creator_department and d.active=true;

  if v_role not in ('admin','tong_bien_tap','pho_tong_bien_tap')
     and (v_manager is distinct from p_actor or v_actor_department is distinct from v_creator_department) then
    raise exception 'forbidden' using errcode='42501';
  end if;

  v_status := case when p_action='approve' then 'APPROVED' else 'REJECTED' end;
  update public.work_schedules
  set approval_status=v_status,reviewed_by=p_actor,reviewed_at=now(),
      review_note=nullif(trim(coalesce(p_note,'')),''),
      workflow_revision=v_old.workflow_revision+1,updated_at=now()
  where id=p_id
  returning * into v_row;

  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor,'admin','work_schedules',v_row.id,
    case when p_action='approve' then 'approve_personal_plan' else 'reject_personal_plan' end,
    to_jsonb(v_old),to_jsonb(v_row));
  return v_row;
end $function$;

revoke all on function public.api_create_personal_work_schedule(uuid,uuid,date,date,text,time,time,text,text,text,uuid[],bigint) from public,anon,authenticated;
revoke all on function public.api_review_personal_work_schedule(uuid,uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.api_create_personal_work_schedule(uuid,uuid,date,date,text,time,time,text,text,text,uuid[],bigint) to service_role;
grant execute on function public.api_review_personal_work_schedule(uuid,uuid,text,text,bigint) to service_role;
alter function public.api_create_personal_work_schedule(uuid,uuid,date,date,text,time,time,text,text,text,uuid[],bigint) owner to postgres;
alter function public.api_review_personal_work_schedule(uuid,uuid,text,text,bigint) owner to postgres;

notify pgrst,'reload schema';
commit;

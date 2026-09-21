begin;

alter table public.work_schedules
  add column if not exists event_assignment_kind text,
  add column if not exists event_type text,
  add column if not exists creator_department_id uuid references public.departments(id),
  add column if not exists event_status text;

alter table public.work_schedules
  drop constraint if exists work_schedules_event_assignment_kind_check,
  drop constraint if exists work_schedules_event_status_check;

alter table public.work_schedules
  add constraint work_schedules_event_assignment_kind_check
    check (event_assignment_kind is null or event_assignment_kind = 'leadership'),
  add constraint work_schedules_event_status_check
    check (event_status is null or event_status in ('SCHEDULED', 'COMPLETED', 'CANCELLED'));

alter table public.work_schedules
  drop constraint if exists work_schedules_leadership_event_shape_check;

alter table public.work_schedules
  add constraint work_schedules_leadership_event_shape_check
    check (
      event_assignment_kind is null
      or (
        event_assignment_kind = 'leadership'
        and schedule_scope = 'organization'
        and plan_type = 'event'
        and approval_status = 'APPROVED'
        and event_type is not null
        and creator_department_id is not null
        and event_status is not null
      )
    );

create index if not exists work_schedules_event_date_idx
  on public.work_schedules(work_date, end_date)
  where event_assignment_kind = 'leadership';

create table if not exists public.work_schedule_event_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.work_schedules(id) on delete cascade,
  staff_id uuid not null references public.staff_users(id),
  assigned_by uuid not null references public.staff_users(id),
  assigned_at timestamptz not null default now(),
  note text,
  unique (event_id, staff_id)
);

create index if not exists work_schedule_event_assignments_event_idx
  on public.work_schedule_event_assignments(event_id);
create index if not exists work_schedule_event_assignments_staff_idx
  on public.work_schedule_event_assignments(staff_id);

alter table public.work_schedule_event_assignments enable row level security;
revoke all on public.work_schedule_event_assignments from public, anon, authenticated;
grant select, insert, update, delete on public.work_schedule_event_assignments to service_role;

create or replace function public.api_create_event_assignment(
  p_actor uuid,
  p_work_date date,
  p_end_date date,
  p_start_time time,
  p_end_time time,
  p_event_type text,
  p_title text,
  p_location text,
  p_notes text,
  p_reporter_ids uuid[]
) returns public.work_schedules
language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_actor_department uuid;
  v_role text;
  v_job text;
  v_row public.work_schedules;
  v_reporter uuid;
begin
  select u.department_id, lower(r.code), lower(coalesce(jt.code, ''))
    into v_actor_department, v_role, v_job
  from public.staff_users u
  join public.roles r on r.id=u.role_id
  left join public.job_titles jt on jt.id=u.job_title_id
  where u.id=p_actor and u.active=true;
  if not found or not (v_role in ('admin','tong_bien_tap','pho_tong_bien_tap') or v_job='truong_phong') then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if v_role = 'pho_truong_phong' then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_work_date is null or p_end_date is null or p_end_date < p_work_date
     or p_start_time is null or p_end_time is null
     or (p_work_date = p_end_date and p_end_time <= p_start_time)
     or length(trim(coalesce(p_title,''))) not between 1 and 500
     or length(trim(coalesce(p_event_type,''))) not between 1 and 100
     or length(coalesce(p_location,'')) > 500
     or length(coalesce(p_notes,'')) > 2000
     or coalesce(array_length(p_reporter_ids,1),0) not between 1 and 50
     or exists(select 1 from unnest(p_reporter_ids) x group by x having count(*) > 1)
  then raise exception 'invalid event' using errcode='22023'; end if;
  if exists (
    select 1 from unnest(p_reporter_ids) x
    where not exists (
      select 1 from public.staff_users s
      left join public.roles sr on sr.id=s.role_id
      left join public.job_titles sj on sj.id=s.job_title_id
      where s.id=x and s.active=true
        and (lower(coalesce(sj.code,'')) like 'phong_vien%' or lower(coalesce(sr.code,''))='phong_vien')
        and (v_role in ('admin','tong_bien_tap','pho_tong_bien_tap') or s.department_id=v_actor_department)
    )
  ) then raise exception 'invalid reporter scope' using errcode='42501'; end if;

  insert into public.work_schedules(
    work_date,end_date,plan_type,start_time,end_time,title,location,notes,participant_ids,
    created_by,schedule_scope,approval_status,workflow_revision,event_assignment_kind,
    event_type,creator_department_id,event_status,updated_at
  ) values (
    p_work_date,p_end_date,'event',p_start_time,p_end_time,trim(p_title),
    nullif(trim(p_location),''),nullif(trim(p_notes),''),p_reporter_ids,
    p_actor,'organization','APPROVED',1,'leadership',trim(p_event_type),
    v_actor_department,'SCHEDULED',now()
  ) returning * into v_row;

  foreach v_reporter in array p_reporter_ids loop
    insert into public.work_schedule_event_assignments(event_id,staff_id,assigned_by)
      values(v_row.id,v_reporter,p_actor);
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
      values(p_actor,'admin','work_schedule_event_assignments',v_row.id,'assign_reporter',
             jsonb_build_object('event_id',v_row.id,'staff_id',v_reporter,'assigned_by',p_actor));
  end loop;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
    values(p_actor,'admin','work_schedules',v_row.id,'create_event',to_jsonb(v_row));
  return v_row;
end $function$;

create or replace function public.api_update_event_assignment(
  p_actor uuid,
  p_id uuid,
  p_expected_revision bigint,
  p_work_date date,
  p_end_date date,
  p_start_time time,
  p_end_time time,
  p_event_type text,
  p_title text,
  p_location text,
  p_notes text,
  p_reporter_ids uuid[]
) returns public.work_schedules
language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_actor_department uuid;
  v_role text;
  v_job text;
  v_old public.work_schedules;
  v_row public.work_schedules;
  v_reporter uuid;
  v_assignment public.work_schedule_event_assignments;
begin
  select u.department_id, lower(r.code), lower(coalesce(jt.code, ''))
    into v_actor_department, v_role, v_job
  from public.staff_users u join public.roles r on r.id=u.role_id
  left join public.job_titles jt on jt.id=u.job_title_id
  where u.id=p_actor and u.active=true;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  if v_role = 'pho_truong_phong' then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select * into v_old from public.work_schedules where id=p_id for update;
  if not found or v_old.event_assignment_kind <> 'leadership' then
    raise exception 'event unavailable' using errcode='P0002';
  end if;
  if not (v_role in ('admin','tong_bien_tap','pho_tong_bien_tap')
      or (v_job='truong_phong' and v_old.created_by=p_actor and v_old.creator_department_id=v_actor_department))
  then raise exception 'forbidden' using errcode='42501'; end if;
  if p_expected_revision is null or p_expected_revision <> v_old.workflow_revision then
    raise exception 'stale event' using errcode='40001';
  end if;
  if v_old.event_status <> 'SCHEDULED' then raise exception 'event is terminal' using errcode='42501'; end if;
  if p_work_date is null or p_end_date is null or p_end_date < p_work_date
     or p_start_time is null or p_end_time is null
     or (p_work_date = p_end_date and p_end_time <= p_start_time)
     or length(trim(coalesce(p_title,''))) not between 1 and 500
     or length(trim(coalesce(p_event_type,''))) not between 1 and 100
     or length(coalesce(p_location,'')) > 500 or length(coalesce(p_notes,'')) > 2000
     or coalesce(array_length(p_reporter_ids,1),0) not between 1 and 50
     or exists(select 1 from unnest(p_reporter_ids) x group by x having count(*) > 1)
  then raise exception 'invalid event' using errcode='22023'; end if;
  if exists (
    select 1 from unnest(p_reporter_ids) x
    where not exists (
      select 1 from public.staff_users s left join public.roles sr on sr.id=s.role_id
      left join public.job_titles sj on sj.id=s.job_title_id
      where s.id=x and s.active=true
        and (lower(coalesce(sj.code,'')) like 'phong_vien%' or lower(coalesce(sr.code,''))='phong_vien')
        and (v_role in ('admin','tong_bien_tap','pho_tong_bien_tap') or s.department_id=v_actor_department)
    )
  ) then raise exception 'invalid reporter scope' using errcode='42501'; end if;
  for v_assignment in
    select * from public.work_schedule_event_assignments
    where event_id=p_id and not (staff_id=any(p_reporter_ids))
  loop
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data)
      values(p_actor,'admin','work_schedule_event_assignments',p_id,'unassign_reporter',
             jsonb_build_object('event_id',p_id,'staff_id',v_assignment.staff_id,
                                'assigned_by',v_assignment.assigned_by,'assigned_at',v_assignment.assigned_at));
  end loop;
  delete from public.work_schedule_event_assignments
    where event_id=p_id and not (staff_id=any(p_reporter_ids));
  update public.work_schedules set
    work_date=p_work_date,end_date=p_end_date,start_time=p_start_time,end_time=p_end_time,
    title=trim(p_title),location=nullif(trim(p_location),''),notes=nullif(trim(p_notes),''),
    participant_ids=p_reporter_ids,event_type=trim(p_event_type),workflow_revision=workflow_revision+1,
    updated_at=now()
  where id=p_id returning * into v_row;
  foreach v_reporter in array p_reporter_ids loop
    if not exists (
      select 1 from public.work_schedule_event_assignments
      where event_id=v_row.id and staff_id=v_reporter
    ) then
      insert into public.work_schedule_event_assignments(event_id,staff_id,assigned_by)
        values(v_row.id,v_reporter,p_actor);
      insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
        values(p_actor,'admin','work_schedule_event_assignments',v_row.id,'assign_reporter',
               jsonb_build_object('event_id',v_row.id,'staff_id',v_reporter,'assigned_by',p_actor));
    end if;
  end loop;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
    values(p_actor,'admin','work_schedules',v_row.id,'update_event',to_jsonb(v_old),to_jsonb(v_row));
  return v_row;
end $function$;

create or replace function public.api_set_event_assignment_status(
  p_actor uuid,
  p_id uuid,
  p_expected_revision bigint,
  p_action text
) returns public.work_schedules
language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_actor_department uuid;
  v_role text;
  v_job text;
  v_old public.work_schedules;
  v_row public.work_schedules;
  v_status text;
  v_audit_action text;
begin
  if p_action not in ('cancel','complete') then raise exception 'invalid event action' using errcode='22023'; end if;
  select u.department_id, lower(r.code), lower(coalesce(jt.code, ''))
    into v_actor_department, v_role, v_job
  from public.staff_users u join public.roles r on r.id=u.role_id
  left join public.job_titles jt on jt.id=u.job_title_id
  where u.id=p_actor and u.active=true;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  if v_role = 'pho_truong_phong' then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select * into v_old from public.work_schedules where id=p_id for update;
  if not found or v_old.event_assignment_kind <> 'leadership' then raise exception 'event unavailable' using errcode='P0002'; end if;
  if not (v_role in ('admin','tong_bien_tap','pho_tong_bien_tap')
      or (v_job='truong_phong' and v_old.created_by=p_actor and v_old.creator_department_id=v_actor_department))
  then raise exception 'forbidden' using errcode='42501'; end if;
  if p_expected_revision is null or p_expected_revision <> v_old.workflow_revision
     or v_old.event_status <> 'SCHEDULED' then raise exception 'stale event' using errcode='40001'; end if;
  v_status := case when p_action='cancel' then 'CANCELLED' else 'COMPLETED' end;
  v_audit_action := case when p_action='cancel' then 'cancel_event' else 'complete_event' end;
  update public.work_schedules set event_status=v_status,workflow_revision=workflow_revision+1,updated_at=now()
    where id=p_id returning * into v_row;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
    values(p_actor,'admin','work_schedules',v_row.id,v_audit_action,to_jsonb(v_old),to_jsonb(v_row));
  return v_row;
end $function$;

revoke all on function public.api_create_event_assignment(uuid,date,date,time,time,text,text,text,text,uuid[]) from public,anon,authenticated;
revoke all on function public.api_update_event_assignment(uuid,uuid,bigint,date,date,time,time,text,text,text,text,uuid[]) from public,anon,authenticated;
revoke all on function public.api_set_event_assignment_status(uuid,uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.api_create_event_assignment(uuid,date,date,time,time,text,text,text,text,uuid[]) to service_role;
grant execute on function public.api_update_event_assignment(uuid,uuid,bigint,date,date,time,time,text,text,text,text,uuid[]) to service_role;
grant execute on function public.api_set_event_assignment_status(uuid,uuid,bigint,text) to service_role;
alter function public.api_create_event_assignment(uuid,date,date,time,time,text,text,text,text,uuid[]) owner to postgres;
alter function public.api_update_event_assignment(uuid,uuid,bigint,date,date,time,time,text,text,text,text,uuid[]) owner to postgres;
alter function public.api_set_event_assignment_status(uuid,uuid,bigint,text) owner to postgres;

notify pgrst, 'reload schema';
commit;

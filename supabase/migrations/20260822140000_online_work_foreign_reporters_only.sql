begin;

create table if not exists public.online_work_schedules (
  id uuid primary key default gen_random_uuid(),
  work_date date not null,
  staff_id uuid not null references public.staff_users(id),
  status text not null default 'active' check (status in ('active','cancelled')),
  created_by uuid not null references public.staff_users(id),
  cancelled_by uuid references public.staff_users(id),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists online_work_schedules_active_date_uidx
  on public.online_work_schedules(work_date) where status='active';
create index if not exists online_work_schedules_staff_date_idx
  on public.online_work_schedules(staff_id,work_date);

alter table public.online_work_schedules enable row level security;
revoke all on public.online_work_schedules from public,anon,authenticated;
grant select,insert,update on public.online_work_schedules to service_role;

create or replace function public.api_save_monthly_online_work_schedule(
  p_actor uuid,
  p_work_month date,
  p_days jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_month date := date_trunc('month',p_work_month)::date;
  v_month_end date := (date_trunc('month',p_work_month)+interval '1 month' - interval '1 day')::date;
  v_day jsonb;
  v_date date;
  v_staff uuid;
  v_existing public.online_work_schedules;
  v_row public.online_work_schedules;
  v_created int := 0;
  v_updated int := 0;
  v_cancelled int := 0;
  v_unchanged int := 0;
begin
  if not public.phase7_is_admin(p_actor) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_work_month is null or p_work_month<>v_month or jsonb_typeof(p_days)<>'array'
     or jsonb_array_length(p_days)>31 then
    raise exception 'invalid online work schedule' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('monthly-online-work:'||v_month::text));

  create temporary table pg_temp.requested_online_work(
    work_date date primary key,
    staff_id uuid not null
  ) on commit drop;

  for v_day in select value from jsonb_array_elements(p_days) loop
    if jsonb_typeof(v_day)<>'object' then
      raise exception 'invalid online work day' using errcode='22023';
    end if;
    begin
      v_date := (v_day->>'date')::date;
      v_staff := (v_day->>'staffId')::uuid;
    exception when others then
      raise exception 'invalid online work assignment' using errcode='22023';
    end;
    if v_date<v_month or v_date>v_month_end then
      raise exception 'online work date outside month' using errcode='22023';
    end if;
    if not exists(
      select 1 from public.staff_users su
      join public.job_titles jt on jt.id=su.job_title_id
      where su.id=v_staff and su.active=true and lower(jt.code) like 'phong_vien_%'
        and lower(su.username) in ('thuphuong','thithuy','ngocanh','minhduc','ducanh','bachduong')
    ) then
      raise exception 'online worker must be an active reporter' using errcode='22023';
    end if;
    begin
      insert into pg_temp.requested_online_work values(v_date,v_staff);
    exception when unique_violation then
      raise exception 'duplicate online work date' using errcode='22023';
    end;
  end loop;

  for v_existing in
    select * from public.online_work_schedules
    where work_date between v_month and v_month_end and status='active'
    order by id for update
  loop
    if exists(select 1 from pg_temp.requested_online_work r where r.work_date=v_existing.work_date) then
      select staff_id into v_staff from pg_temp.requested_online_work where work_date=v_existing.work_date;
      if v_existing.staff_id=v_staff then
        v_unchanged:=v_unchanged+1;
      else
        update public.online_work_schedules set staff_id=v_staff,updated_at=now()
        where id=v_existing.id returning * into v_row;
        insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
        values(p_actor,'configuration','online_work_schedules',v_existing.id,'update_online_work',to_jsonb(v_existing),to_jsonb(v_row));
        v_updated:=v_updated+1;
      end if;
      delete from pg_temp.requested_online_work where work_date=v_existing.work_date;
    else
      update public.online_work_schedules set status='cancelled',cancelled_by=p_actor,cancelled_at=now(),updated_at=now()
      where id=v_existing.id returning * into v_row;
      insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
      values(p_actor,'configuration','online_work_schedules',v_existing.id,'cancel_online_work',to_jsonb(v_existing),to_jsonb(v_row));
      v_cancelled:=v_cancelled+1;
    end if;
  end loop;

  for v_date,v_staff in select work_date,staff_id from pg_temp.requested_online_work order by work_date loop
    insert into public.online_work_schedules(work_date,staff_id,created_by)
    values(v_date,v_staff,p_actor) returning * into v_row;
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
    values(p_actor,'configuration','online_work_schedules',v_row.id,'create_online_work',to_jsonb(v_row));
    v_created:=v_created+1;
  end loop;

  return jsonb_build_object('created',v_created,'updated',v_updated,'cancelled',v_cancelled,'unchanged',v_unchanged);
end
$function$;

revoke all on function public.api_save_monthly_online_work_schedule(uuid,date,jsonb) from public,anon,authenticated;
grant execute on function public.api_save_monthly_online_work_schedule(uuid,date,jsonb) to service_role;
alter function public.api_save_monthly_online_work_schedule(uuid,date,jsonb) owner to postgres;
notify pgrst,'reload schema';
commit;

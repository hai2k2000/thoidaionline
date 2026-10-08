begin;

create table public.personal_weekly_report_versions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.personal_weekly_reports(id),
  version_no integer not null check (version_no > 0),
  employee_id uuid not null references public.staff_users(id),
  department_id uuid not null references public.departments(id),
  period_start date not null,
  period_end date not null,
  snapshot_payload jsonb not null,
  difficulties text not null default '',
  completed_by uuid not null references public.staff_users(id),
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (report_id, version_no)
);

create index personal_weekly_report_versions_report_version_desc_idx
  on public.personal_weekly_report_versions (report_id, version_no desc);

alter table public.personal_weekly_report_versions enable row level security;
revoke all on table public.personal_weekly_report_versions from public, anon, authenticated;
grant select on table public.personal_weekly_report_versions to service_role;
revoke insert, update, delete on table public.personal_weekly_reports from service_role;

create or replace function public.personal_weekly_report_versions_immutable()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op in ('UPDATE','DELETE') then
    raise exception 'immutable personal weekly report versions' using errcode='42501';
  end if;
  return new;
end;
$$;

drop trigger if exists personal_weekly_report_versions_immutable on public.personal_weekly_report_versions;
create trigger personal_weekly_report_versions_immutable
before update or delete on public.personal_weekly_report_versions
for each row execute function public.personal_weekly_report_versions_immutable();

create or replace function public.personal_weekly_reports_immutable()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if old.status = 'COMPLETED' then
    if tg_op='UPDATE'
       and new.status='DRAFT'
       and current_setting('app.personal_weekly_report_reopen_id',true)=old.id::text then
      return new;
    end if;
    raise exception 'completed personal weekly reports are immutable' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists personal_weekly_reports_completed_immutable on public.personal_weekly_reports;
create trigger personal_weekly_reports_completed_immutable
before update or delete on public.personal_weekly_reports
for each row execute function public.personal_weekly_reports_immutable();

create or replace function public.api_complete_personal_weekly_report(
  p_actor uuid, p_employee uuid, p_period_start date, p_period_end date,
  p_snapshot_payload jsonb, p_difficulties text
)
returns public.personal_weekly_reports
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_report public.personal_weekly_reports;
  v_department uuid;
  v_snapshot jsonb;
  v_version integer;
begin
  if p_actor is distinct from p_employee then raise exception 'report ownership mismatch' using errcode='42501'; end if;
  if p_period_start is null or p_period_end is null or extract(isodow from p_period_start)<>5 or p_period_end<>p_period_start+7 then
    raise exception 'invalid report period' using errcode='22023';
  end if;
  select department_id into v_department from public.staff_users where id=p_employee and active;
  if v_department is null then raise exception 'report ownership mismatch' using errcode='42501'; end if;
  select * into v_report from public.personal_weekly_reports
    where employee_id=p_employee and period_start=p_period_start and period_end=p_period_end for update;
  if not found then
    insert into public.personal_weekly_reports(employee_id,department_id,period_start,period_end,status,draft_payload,difficulties,updated_at)
    values(p_employee,v_department,p_period_start,p_period_end,'DRAFT',coalesce(p_snapshot_payload,'{}'::jsonb),coalesce(p_difficulties,''),now())
    on conflict (employee_id,period_start,period_end) do nothing;
    select * into v_report from public.personal_weekly_reports
      where employee_id=p_employee and period_start=p_period_start and period_end=p_period_end for update;
  end if;
  if v_report.status='COMPLETED' then return v_report; end if;
  v_snapshot:=jsonb_set(coalesce(p_snapshot_payload,'{}'::jsonb),'{difficulties}',to_jsonb(v_report.difficulties),true);
  update public.personal_weekly_reports set status='COMPLETED',snapshot_payload=v_snapshot,completed_at=now(),updated_at=now() where id=v_report.id returning * into v_report;
  select coalesce(max(version_no),0)+1 into v_version from public.personal_weekly_report_versions where report_id=v_report.id;
  insert into public.personal_weekly_report_versions(report_id,version_no,employee_id,department_id,period_start,period_end,snapshot_payload,difficulties,completed_by,completed_at)
  values(v_report.id,v_version,v_report.employee_id,v_report.department_id,v_report.period_start,v_report.period_end,v_report.snapshot_payload,v_report.difficulties,p_actor,v_report.completed_at);
  return v_report;
end;
$$;

create or replace function public.api_reopen_personal_weekly_report(p_actor uuid,p_report_id uuid,p_reason text)
returns public.personal_weekly_reports
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_report public.personal_weekly_reports;
  v_is_admin boolean;
  v_latest public.personal_weekly_report_versions;
  v_reason text:=btrim(coalesce(p_reason,''));
begin
  if p_reason is null or length(btrim(p_reason)) not between 5 and 500 then raise exception 'reopen reason must be 5-500 characters' using errcode='22023'; end if;
  v_is_admin:=public.phase7_is_admin(p_actor);
  select * into v_report from public.personal_weekly_reports where id=p_report_id for update;
  if not found or v_report.status<>'COMPLETED' then raise exception 'completed report not found' using errcode='P0002'; end if;
  if not v_is_admin and v_report.employee_id is distinct from p_actor then raise exception 'report ownership mismatch' using errcode='42501'; end if;
  if not v_is_admin and now()>v_report.completed_at+interval '24 hours' then raise exception 'reopen window expired' using errcode='42501'; end if;
  select * into v_latest from public.personal_weekly_report_versions where report_id=v_report.id order by version_no desc limit 1;
  if not found then
    insert into public.personal_weekly_report_versions(report_id,version_no,employee_id,department_id,period_start,period_end,snapshot_payload,difficulties,completed_by,completed_at)
    values(v_report.id,1,v_report.employee_id,v_report.department_id,v_report.period_start,v_report.period_end,v_report.snapshot_payload,v_report.difficulties,v_report.employee_id,v_report.completed_at)
    returning * into v_latest;
  end if;
  perform set_config('app.personal_weekly_report_reopen_id',v_report.id::text,true);
  update public.personal_weekly_reports set status='DRAFT',draft_payload=v_latest.snapshot_payload,snapshot_payload=null,completed_at=null,updated_at=now() where id=v_report.id returning * into v_report;
  perform set_config('app.personal_weekly_report_reopen_id','',true);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor,'personal_weekly_report','personal_weekly_reports',v_report.id,'personal_weekly_report.reopened',jsonb_build_object('report_id',v_report.id,'version_no',v_latest.version_no,'reason',v_reason));
  return v_report;
end;
$$;

alter function public.api_complete_personal_weekly_report(uuid,uuid,date,date,jsonb,text) owner to postgres;
alter function public.api_reopen_personal_weekly_report(uuid,uuid,text) owner to postgres;
revoke all on function public.api_complete_personal_weekly_report(uuid,uuid,date,date,jsonb,text) from public,anon,authenticated;
revoke all on function public.api_reopen_personal_weekly_report(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.api_complete_personal_weekly_report(uuid,uuid,date,date,jsonb,text) to service_role;
grant execute on function public.api_reopen_personal_weekly_report(uuid,uuid,text) to service_role;

commit;

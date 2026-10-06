begin;

create table public.personal_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.staff_users(id),
  department_id uuid not null references public.departments(id),
  period_start date not null,
  period_end date not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'COMPLETED')),
  draft_payload jsonb not null default '{}'::jsonb,
  snapshot_payload jsonb,
  difficulties text not null default '',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, period_start, period_end),
  check (extract(isodow from period_start) = 5 and period_end = period_start + 7),
  check ((status = 'DRAFT' and snapshot_payload is null and completed_at is null)
      or (status = 'COMPLETED' and snapshot_payload is not null and completed_at is not null))
);

create index personal_weekly_reports_employee_period_idx
  on public.personal_weekly_reports (employee_id, period_start desc, period_end desc);

alter table public.personal_weekly_reports enable row level security;
revoke all on table public.personal_weekly_reports from public, anon, authenticated;
grant select, insert, update, delete on table public.personal_weekly_reports to service_role;

create or replace function public.personal_weekly_reports_immutable()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status = 'COMPLETED' then
    raise exception 'completed personal weekly reports are immutable' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger personal_weekly_reports_completed_immutable
before update or delete on public.personal_weekly_reports
for each row execute function public.personal_weekly_reports_immutable();

create or replace function public.api_save_personal_weekly_report(
  p_actor uuid,
  p_employee uuid,
  p_period_start date,
  p_period_end date,
  p_draft_payload jsonb,
  p_difficulties text
)
returns public.personal_weekly_reports
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_report public.personal_weekly_reports;
  v_department uuid;
begin
  if p_actor is distinct from p_employee then
    raise exception 'report ownership mismatch' using errcode = '42501';
  end if;
  if p_period_start is null or p_period_end is null
     or extract(isodow from p_period_start) <> 5
     or p_period_end <> p_period_start + 7 then
    raise exception 'invalid report period' using errcode = '22023';
  end if;
  select department_id into v_department
    from public.staff_users where id = p_employee and active;
  if v_department is null then
    raise exception 'report ownership mismatch' using errcode = '42501';
  end if;

  insert into public.personal_weekly_reports (
    employee_id, department_id, period_start, period_end,
    status, draft_payload, difficulties, updated_at
  ) values (
    p_employee, v_department, p_period_start, p_period_end,
    'DRAFT', coalesce(p_draft_payload, '{}'::jsonb), coalesce(p_difficulties, ''), now()
  )
  on conflict (employee_id, period_start, period_end) do update
    set department_id = excluded.department_id,
        draft_payload = excluded.draft_payload,
        difficulties = excluded.difficulties,
        updated_at = now()
    where public.personal_weekly_reports.status = 'DRAFT'
  returning * into v_report;

  if v_report.id is null then
    if exists (
      select 1 from public.personal_weekly_reports
      where employee_id = p_employee and period_start = p_period_start and period_end = p_period_end
        and status = 'COMPLETED'
    ) then
      raise exception 'completed personal weekly reports are immutable' using errcode = '42501';
    end if;
    raise exception 'unable to save personal weekly report' using errcode = '42501';
  end if;
  return v_report;
end;
$$;

create or replace function public.api_complete_personal_weekly_report(
  p_actor uuid,
  p_employee uuid,
  p_period_start date,
  p_period_end date,
  p_snapshot_payload jsonb,
  p_difficulties text
)
returns public.personal_weekly_reports
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_report public.personal_weekly_reports;
  v_department uuid;
  v_snapshot jsonb;
begin
  if p_actor is distinct from p_employee then
    raise exception 'report ownership mismatch' using errcode = '42501';
  end if;
  if p_period_start is null or p_period_end is null
     or extract(isodow from p_period_start) <> 5
     or p_period_end <> p_period_start + 7 then
    raise exception 'invalid report period' using errcode = '22023';
  end if;
  select department_id into v_department
    from public.staff_users where id = p_employee and active;
  if v_department is null then
    raise exception 'report ownership mismatch' using errcode = '42501';
  end if;

  select * into v_report
    from public.personal_weekly_reports
   where employee_id = p_employee and period_start = p_period_start and period_end = p_period_end
   for update;
  if not found then
    raise exception 'personal weekly report draft not found' using errcode = 'P0002';
  end if;
  if v_report.status = 'COMPLETED' then
    return v_report;
  end if;

  v_snapshot := jsonb_set(coalesce(p_snapshot_payload, '{}'::jsonb), '{difficulties}', to_jsonb(v_report.difficulties), true);
  insert into public.personal_weekly_reports (
    employee_id, department_id, period_start, period_end, status,
    draft_payload, snapshot_payload, difficulties, completed_at, updated_at
  ) values (
    p_employee, v_department, p_period_start, p_period_end, 'COMPLETED',
    coalesce(v_report.draft_payload, '{}'::jsonb),
    v_snapshot, v_report.difficulties, now(), now()
  )
  on conflict (employee_id, period_start, period_end) do update
    set status = 'COMPLETED',
        snapshot_payload = excluded.snapshot_payload,
        difficulties = excluded.difficulties,
        completed_at = excluded.completed_at,
        updated_at = excluded.updated_at
    where public.personal_weekly_reports.status = 'DRAFT'
  returning * into v_report;
  return v_report;
end;
$$;

alter function public.api_save_personal_weekly_report(uuid, uuid, date, date, jsonb, text) owner to postgres;
alter function public.api_complete_personal_weekly_report(uuid, uuid, date, date, jsonb, text) owner to postgres;
revoke all on function public.api_save_personal_weekly_report(uuid, uuid, date, date, jsonb, text) from public, anon, authenticated;
revoke all on function public.api_complete_personal_weekly_report(uuid, uuid, date, date, jsonb, text) from public, anon, authenticated;
grant execute on function public.api_save_personal_weekly_report(uuid, uuid, date, date, jsonb, text) to service_role;
grant execute on function public.api_complete_personal_weekly_report(uuid, uuid, date, date, jsonb, text) to service_role;

commit;

begin;

create table if not exists public.attendance_workday_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.staff_users(id),
  work_date date not null,
  workday numeric(3,1) not null check (workday in (0, 0.5, 1)),
  reason text not null check (char_length(btrim(reason)) between 3 and 2000),
  created_by uuid not null references public.staff_users(id),
  updated_by uuid not null references public.staff_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_date)
);

create index if not exists attendance_workday_adjustments_date_user_idx
  on public.attendance_workday_adjustments (work_date, user_id);

alter table public.attendance_workday_adjustments enable row level security;
revoke all privileges on table public.attendance_workday_adjustments from public, anon, authenticated;
grant select, insert, update, delete on table public.attendance_workday_adjustments to service_role;

create or replace function public.api_upsert_attendance_workday_adjustment(
  p_actor uuid, p_user_id uuid, p_work_date date, p_workday numeric, p_reason text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.attendance_workday_adjustments;
begin
  if not exists (select 1 from public.api_list_effective_permissions(p_actor) p where p.permission_code = 'attendance.manage' and cardinality(p.effective_scopes) > 0) then
    raise exception 'Attendance adjustment forbidden.' using errcode = '42501';
  end if;
  if p_actor = p_user_id then raise exception 'Self adjustment forbidden.' using errcode = '42501'; end if;
  if p_user_id is null or p_work_date is null or extract(isodow from p_work_date) > 5
     or p_workday not in (0, 0.5, 1) or char_length(btrim(coalesce(p_reason, ''))) not between 3 and 2000 then
    raise exception 'Invalid attendance adjustment.' using errcode = '22023';
  end if;
  insert into public.attendance_workday_adjustments (user_id, work_date, workday, reason, created_by, updated_by)
  values (p_user_id, p_work_date, p_workday, btrim(p_reason), p_actor, p_actor)
  on conflict (user_id, work_date) do update set workday = excluded.workday, reason = excluded.reason, updated_by = excluded.updated_by, updated_at = now()
  returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.api_delete_attendance_workday_adjustment(
  p_actor uuid, p_user_id uuid, p_work_date date
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.api_list_effective_permissions(p_actor) p where p.permission_code = 'attendance.manage' and cardinality(p.effective_scopes) > 0) then
    raise exception 'Attendance adjustment forbidden.' using errcode = '42501';
  end if;
  if p_actor = p_user_id then raise exception 'Self adjustment forbidden.' using errcode = '42501'; end if;
  if p_user_id is null or p_work_date is null or extract(isodow from p_work_date) > 5 then
    raise exception 'Invalid attendance adjustment.' using errcode = '22023';
  end if;
  delete from public.attendance_workday_adjustments where user_id = p_user_id and work_date = p_work_date;
end; $$;

revoke all on function public.api_upsert_attendance_workday_adjustment(uuid, uuid, date, numeric, text) from public, anon, authenticated;
grant execute on function public.api_upsert_attendance_workday_adjustment(uuid, uuid, date, numeric, text) to service_role;
revoke all on function public.api_delete_attendance_workday_adjustment(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.api_delete_attendance_workday_adjustment(uuid, uuid, date) to service_role;
alter function public.api_upsert_attendance_workday_adjustment(uuid, uuid, date, numeric, text) owner to postgres;
alter function public.api_delete_attendance_workday_adjustment(uuid, uuid, date) owner to postgres;

commit;

begin;

create or replace function public.api_merge_attendance_log(
  p_user_id uuid,
  p_work_date date,
  p_check_in time,
  p_check_out time,
  p_source text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_log public.attendance_logs;
begin
  if p_user_id is null or p_work_date is null then
    raise exception 'invalid attendance log identity' using errcode = '22023';
  end if;

  insert into public.attendance_logs (
    user_id, work_date, check_in, check_out, status, source, note, synced_at
  ) values (
    p_user_id, p_work_date, p_check_in, p_check_out, 'present',
    coalesce(nullif(btrim(p_source), ''), 'wise_eye'),
    nullif(btrim(coalesce(p_note, '')), ''), now()
  )
  on conflict (user_id, work_date) do update
  set
    check_in = case
      when public.attendance_logs.check_in is null then excluded.check_in
      when excluded.check_in is null then public.attendance_logs.check_in
      else least(attendance_logs.check_in, excluded.check_in)
    end,
    check_out = case
      when public.attendance_logs.check_out is null then excluded.check_out
      when excluded.check_out is null then public.attendance_logs.check_out
      else greatest(attendance_logs.check_out, excluded.check_out)
    end,
    status = case
      when public.attendance_logs.source <> 'wise_eye' or public.attendance_logs.status = 'leave'
        then public.attendance_logs.status
      else excluded.status
    end,
    source = case
      when public.attendance_logs.source <> 'wise_eye' or public.attendance_logs.status = 'leave'
        then public.attendance_logs.source
      else excluded.source
    end,
    note = case
      when public.attendance_logs.source <> 'wise_eye' or public.attendance_logs.status = 'leave'
        then public.attendance_logs.note
      else coalesce(excluded.note, public.attendance_logs.note)
    end,
    synced_at = greatest(public.attendance_logs.synced_at, excluded.synced_at)
  returning * into v_log;

  return to_jsonb(v_log);
end;
$$;

revoke all on function public.api_merge_attendance_log(uuid, date, time, time, text, text) from public, anon, authenticated;
grant execute on function public.api_merge_attendance_log(uuid, date, time, time, text, text) to service_role;
alter function public.api_merge_attendance_log(uuid, date, time, time, text, text) owner to postgres;

commit;

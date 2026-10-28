-- WARNING: dropping this table permanently loses all workday adjustments. Back it up first.
begin;
drop function if exists public.api_delete_attendance_workday_adjustment(uuid, uuid, date);
drop function if exists public.api_upsert_attendance_workday_adjustment(uuid, uuid, date, numeric, text);
drop table if exists public.attendance_workday_adjustments;
commit;

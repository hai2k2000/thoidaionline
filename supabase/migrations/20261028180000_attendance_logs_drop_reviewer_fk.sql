-- attendance_logs had two foreign keys to staff_users after 20261028160000
-- (user_id and late_exception_reviewed_by), which made unhinted PostgREST
-- embeds `staff_users(...)` ambiguous (PGRST201) and broke /api/attendance.
-- The reviewer column stays; only its FK is dropped. Applied manually on
-- production 2026-10-28 20:15 ICT (owner-approved); this migration records it.
begin;
alter table public.attendance_logs drop constraint if exists attendance_logs_late_exception_reviewed_by_fkey;
notify pgrst, 'reload schema';
commit;

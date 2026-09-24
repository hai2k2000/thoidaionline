begin;

alter table public.attendance_sync_requests
  add column if not exists finished_at timestamptz;

commit;

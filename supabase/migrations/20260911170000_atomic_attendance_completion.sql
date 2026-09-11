begin;

alter table public.attendance_sync_requests
  drop constraint if exists attendance_sync_requests_status_check;
alter table public.attendance_sync_requests
  add constraint attendance_sync_requests_status_check
  check (status in ('pending','running','completing','succeeded','failed'));
drop index if exists public.attendance_sync_requests_active_uidx;
create unique index attendance_sync_requests_active_uidx
  on public.attendance_sync_requests ((1))
  where status in ('pending', 'running', 'completing');

commit;

begin;

alter table public.staff_users add column if not exists attendance_code text;
create unique index if not exists staff_users_attendance_code_uidx on public.staff_users (attendance_code) where attendance_code is not null;

create table if not exists public.attendance_sync_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references public.staff_users(id),
  status text not null default 'pending' check (status in ('pending','running','succeeded','failed')),
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  result jsonb,
  error text
);
create index if not exists attendance_sync_requests_queue_idx on public.attendance_sync_requests (status, requested_at);
create unique index if not exists attendance_sync_requests_active_uidx on public.attendance_sync_requests ((1)) where status in ('pending', 'running');

create table if not exists public.attendance_punches (
  id uuid primary key default gen_random_uuid(), device_id text not null, enroll_number text not null,
  punched_at timestamptz not null, verify_mode integer, in_out_mode integer, work_code integer,
  imported_at timestamptz not null default now(), unique (device_id, enroll_number, punched_at)
);
create index if not exists attendance_punches_user_time_idx on public.attendance_punches (enroll_number, punched_at);

create table if not exists public.attendance_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.staff_users(id) on delete cascade,
  work_date date not null, check_in time, check_out time, note text,
  status text not null default 'present' check (status in ('present','absent','late','leave')),
  source text not null default 'wise_eye', synced_at timestamptz not null default now(), unique (user_id, work_date)
);
create index if not exists attendance_logs_date_idx on public.attendance_logs (work_date, user_id);

-- Device codes confirmed from the Wise Eye export. Code 10 and absent users remain unmapped.
update public.staff_users set attendance_code = mapping.code
from (values
  ('1','quangthien'), ('2','dinhhai'), ('3','thihung'), ('4','duydong'), ('5','thanhhai'),
  ('6','quynhtrang'), ('7','leson'), ('8','tungduong'), ('9','vananh'), ('11','vanmanh'),
  ('12','triduong'), ('13','bachduong'), ('14','thuphuong'), ('15','bichthuan'), ('16','hongninh'),
  ('17','thily'), ('18','maianh'), ('19','thithuy'), ('20','thuhuong'), ('21','thidoan'),
  ('22','ngocanh'), ('23','xuanhoa'), ('24','minhduc'), ('25','ducanh')
) as mapping(code, username)
where public.staff_users.username = mapping.username
  and (public.staff_users.attendance_code is null or public.staff_users.attendance_code = mapping.code);

alter table public.attendance_sync_requests enable row level security;
alter table public.attendance_punches enable row level security;
alter table public.attendance_logs enable row level security;
revoke all privileges on table public.attendance_sync_requests, public.attendance_punches, public.attendance_logs from public, anon, authenticated;
grant select, insert, update, delete on table public.attendance_sync_requests, public.attendance_punches, public.attendance_logs to service_role;

commit;

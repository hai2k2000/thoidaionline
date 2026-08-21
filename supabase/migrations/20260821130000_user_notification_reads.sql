begin;

create table if not exists public.user_notification_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.staff_users(id) on delete cascade,
  notification_key text not null,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint user_notification_reads_key_check check (
    length(notification_key) between 1 and 300
  ),
  constraint user_notification_reads_user_key_unique unique(user_id,notification_key)
);

create index if not exists user_notification_reads_user_read_idx
  on public.user_notification_reads(user_id,read_at desc);

alter table public.user_notification_reads enable row level security;
revoke all on table public.user_notification_reads from public,anon,authenticated;
grant select,insert,update on table public.user_notification_reads to service_role;

commit;

begin;
create table if not exists public.work_schedules (
 id uuid primary key default gen_random_uuid(), work_date date not null, start_time time, end_time time,
 title text not null, location text, notes text, participant_ids uuid[] not null default '{}', created_by uuid not null references public.staff_users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists work_schedules_date_idx on public.work_schedules(work_date);
commit;

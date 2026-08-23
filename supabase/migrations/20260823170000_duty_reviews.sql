begin;

create table if not exists public.duty_task_reviews (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  result text not null check (result in ('completed','issues','not_completed')),
  on_time boolean not null,
  issue_notes text,
  evidence_path text,
  evidence_name text,
  evidence_mime text,
  evidence_size bigint check (evidence_size is null or evidence_size between 1 and 10485760),
  reviewed_by uuid not null references public.staff_users(id),
  reviewed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.duty_task_reviews enable row level security;
revoke all on table public.duty_task_reviews from public, anon, authenticated;
grant all on table public.duty_task_reviews to service_role;

notify pgrst, 'reload schema';
commit;

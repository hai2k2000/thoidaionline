create table if not exists public.mobile_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.staff_users(id) on delete cascade,
  fcm_token text not null unique,
  platform text not null default 'android',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mobile_push_tokens_user_id_idx
  on public.mobile_push_tokens(user_id);

alter table public.mobile_push_tokens enable row level security;

drop policy if exists "mobile_push_tokens_select_own" on public.mobile_push_tokens;
create policy "mobile_push_tokens_select_own"
  on public.mobile_push_tokens
  for select
  using (true);

drop policy if exists "mobile_push_tokens_insert_any" on public.mobile_push_tokens;
create policy "mobile_push_tokens_insert_any"
  on public.mobile_push_tokens
  for insert
  with check (true);

drop policy if exists "mobile_push_tokens_update_any" on public.mobile_push_tokens;
create policy "mobile_push_tokens_update_any"
  on public.mobile_push_tokens
  for update
  using (true)
  with check (true);

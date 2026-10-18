-- CP6: durable, service-only audit delivery intent. No worker is started here.
create table if not exists public.database_audit_outbox (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique check (length(btrim(idempotency_key)) between 16 and 200),
  actor_id uuid references public.staff_users(id),
  module text not null check (length(btrim(module)) between 1 and 80),
  entity_type text not null check (length(btrim(entity_type)) between 1 and 120),
  entity_id uuid,
  action text not null check (length(btrim(action)) between 1 and 120),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending' check (status in ('pending','delivered','failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0 and attempt_count <= 10),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists database_audit_outbox_pending_idx
  on public.database_audit_outbox(status, next_attempt_at, created_at);

alter table public.database_audit_outbox enable row level security;
revoke all on table public.database_audit_outbox from public, anon, authenticated;
grant select, insert, update on table public.database_audit_outbox to service_role;

alter table public.audit_logs add column if not exists idempotency_key text;
create unique index if not exists audit_logs_idempotency_key_idx
  on public.audit_logs(idempotency_key) where idempotency_key is not null;

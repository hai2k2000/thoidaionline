-- Phase 1 MVP foundation for:
-- 1) Ho so nhan su
-- 2) Danh gia hieu suat
-- 3) Quan ly tai san
-- 4) Quan ly cong van

create extension if not exists pgcrypto;

-- =========================
-- HR profile
-- =========================
create table if not exists public.employee_profiles (
  user_id uuid primary key references public.staff_users(id) on delete cascade,
  employee_code text unique not null,
  date_of_birth date,
  gender text check (gender in ('male','female','other')),
  id_number text,
  address text,
  join_date date,
  contract_type text check (contract_type in ('intern','probation','official','contractor')),
  contract_start date,
  contract_end date,
  emergency_contact_name text,
  emergency_contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_employee_profiles_employee_code on public.employee_profiles(employee_code);
create index if not exists idx_employee_profiles_contract_end on public.employee_profiles(contract_end);

-- =========================
-- Performance review
-- =========================
create table if not exists public.performance_cycles (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'draft' check (status in ('draft','open','closed')),
  created_by uuid references public.staff_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.performance_criteria (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.performance_cycles(id) on delete cascade,
  department_id uuid references public.departments(id),
  role_id uuid references public.roles(id),
  criterion_name text not null,
  weight numeric(5,2) not null default 1,
  max_score numeric(5,2) not null default 5,
  sort_order int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.performance_reviews (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.performance_cycles(id) on delete cascade,
  employee_id uuid not null references public.staff_users(id),
  reviewer_id uuid references public.staff_users(id),
  self_score numeric(5,2),
  reviewer_score numeric(5,2),
  final_score numeric(5,2),
  rank text,
  self_comment text,
  reviewer_comment text,
  status text not null default 'draft' check (status in ('draft','submitted','reviewed','approved')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, employee_id)
);

create index if not exists idx_performance_reviews_cycle on public.performance_reviews(cycle_id);
create index if not exists idx_performance_reviews_employee on public.performance_reviews(employee_id);

-- =========================
-- Asset management
-- =========================
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  asset_code text unique not null,
  asset_name text not null,
  category text not null,
  serial_number text,
  purchase_date date,
  purchase_cost numeric(14,2),
  status text not null default 'available' check (status in ('available','in_use','maintenance','broken','liquidated')),
  assigned_department_id uuid references public.departments(id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.asset_assignments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete restrict,
  assignee_id uuid references public.staff_users(id),
  department_id uuid references public.departments(id),
  assigned_at timestamptz not null default now(),
  expected_return_at timestamptz,
  returned_at timestamptz,
  status text not null default 'active' check (status in ('active','returned','lost','damaged')),
  handover_note text,
  return_note text,
  created_by uuid references public.staff_users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_asset_assignments_asset on public.asset_assignments(asset_id);
create index if not exists idx_asset_assignments_assignee on public.asset_assignments(assignee_id);

-- =========================
-- Official documents (incoming/outgoing)
-- =========================
create table if not exists public.official_documents (
  id uuid primary key default gen_random_uuid(),
  doc_code text unique not null,
  direction text not null check (direction in ('incoming','outgoing','contract','common')),
  title text not null,
  summary text,
  issuer text,
  received_date date,
  signed_date date,
  urgency text not null default 'normal' check (urgency in ('normal','important','urgent')),
  confidentiality text not null default 'normal' check (confidentiality in ('normal','internal','secret')),
  status text not null default 'new' check (status in ('new','in_progress','done','archived')),
  processing_deadline date,
  owner_user_id uuid references public.staff_users(id),
  owner_department_id uuid references public.departments(id),
  attachment_url text,
  note text,
  created_by uuid references public.staff_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_official_documents_direction_status on public.official_documents(direction, status);
create index if not exists idx_official_documents_deadline on public.official_documents(processing_deadline);

create table if not exists public.document_assignments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.official_documents(id) on delete cascade,
  assignee_id uuid not null references public.staff_users(id),
  assigned_by uuid references public.staff_users(id),
  assigned_at timestamptz not null default now(),
  due_date date,
  status text not null default 'todo' check (status in ('todo','in_progress','done','overdue')),
  result_note text,
  completed_at timestamptz
);

create index if not exists idx_document_assignments_doc on public.document_assignments(document_id);
create index if not exists idx_document_assignments_assignee on public.document_assignments(assignee_id);

-- =========================
-- Generic audit logs
-- =========================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.staff_users(id),
  module text not null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_module_created_at on public.audit_logs(module, created_at desc);

-- =========================
-- RLS (MVP permissive, aligned with current project mode)
-- =========================
alter table public.employee_profiles enable row level security;
alter table public.performance_cycles enable row level security;
alter table public.performance_criteria enable row level security;
alter table public.performance_reviews enable row level security;
alter table public.assets enable row level security;
alter table public.asset_assignments enable row level security;
alter table public.official_documents enable row level security;
alter table public.document_assignments enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "public read employee_profiles" on public.employee_profiles;
drop policy if exists "public write employee_profiles" on public.employee_profiles;
create policy "public read employee_profiles" on public.employee_profiles for select to anon using (true);
create policy "public write employee_profiles" on public.employee_profiles for all to anon using (true) with check (true);

drop policy if exists "public read performance_cycles" on public.performance_cycles;
drop policy if exists "public write performance_cycles" on public.performance_cycles;
create policy "public read performance_cycles" on public.performance_cycles for select to anon using (true);
create policy "public write performance_cycles" on public.performance_cycles for all to anon using (true) with check (true);

drop policy if exists "public read performance_criteria" on public.performance_criteria;
drop policy if exists "public write performance_criteria" on public.performance_criteria;
create policy "public read performance_criteria" on public.performance_criteria for select to anon using (true);
create policy "public write performance_criteria" on public.performance_criteria for all to anon using (true) with check (true);

drop policy if exists "public read performance_reviews" on public.performance_reviews;
drop policy if exists "public write performance_reviews" on public.performance_reviews;
create policy "public read performance_reviews" on public.performance_reviews for select to anon using (true);
create policy "public write performance_reviews" on public.performance_reviews for all to anon using (true) with check (true);

drop policy if exists "public read assets" on public.assets;
drop policy if exists "public write assets" on public.assets;
create policy "public read assets" on public.assets for select to anon using (true);
create policy "public write assets" on public.assets for all to anon using (true) with check (true);

drop policy if exists "public read asset_assignments" on public.asset_assignments;
drop policy if exists "public write asset_assignments" on public.asset_assignments;
create policy "public read asset_assignments" on public.asset_assignments for select to anon using (true);
create policy "public write asset_assignments" on public.asset_assignments for all to anon using (true) with check (true);

drop policy if exists "public read official_documents" on public.official_documents;
drop policy if exists "public write official_documents" on public.official_documents;
create policy "public read official_documents" on public.official_documents for select to anon using (true);
create policy "public write official_documents" on public.official_documents for all to anon using (true) with check (true);

drop policy if exists "public read document_assignments" on public.document_assignments;
drop policy if exists "public write document_assignments" on public.document_assignments;
create policy "public read document_assignments" on public.document_assignments for select to anon using (true);
create policy "public write document_assignments" on public.document_assignments for all to anon using (true) with check (true);

drop policy if exists "public read audit_logs" on public.audit_logs;
drop policy if exists "public write audit_logs" on public.audit_logs;
create policy "public read audit_logs" on public.audit_logs for select to anon using (true);
create policy "public write audit_logs" on public.audit_logs for all to anon using (true) with check (true);

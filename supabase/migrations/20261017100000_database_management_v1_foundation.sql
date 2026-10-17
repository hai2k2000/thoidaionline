begin;

-- Database Management V1 foundation. All business access remains server/RPC-only.
create table if not exists public.db_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.db_categories(id) on delete restrict,
  code text not null unique check (length(btrim(code)) between 1 and 120),
  name text not null check (length(btrim(name)) between 1 and 240),
  department_id uuid references public.departments(id) on delete restrict,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.db_record_types (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.db_categories(id) on delete restrict,
  code text not null unique check (length(btrim(code)) between 1 and 120),
  name text not null check (length(btrim(name)) between 1 and 240),
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.db_form_definitions (
  id uuid primary key default gen_random_uuid(),
  record_type_id uuid not null references public.db_record_types(id) on delete restrict,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  search_config jsonb not null default '{}'::jsonb check (jsonb_typeof(search_config) = 'object'),
  display_config jsonb not null default '{}'::jsonb check (jsonb_typeof(display_config) = 'object'),
  created_by uuid references public.staff_users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (record_type_id, version)
);

create table if not exists public.db_form_fields (
  id uuid primary key default gen_random_uuid(),
  form_definition_id uuid not null references public.db_form_definitions(id) on delete cascade,
  field_key text not null check (field_key ~ '^[a-z][a-z0-9_]{0,119}$'),
  label text not null check (length(btrim(label)) between 1 and 240),
  data_type text not null check (data_type in ('text', 'long_text', 'date', 'datetime', 'number', 'boolean', 'select', 'multi_select', 'person', 'department', 'country', 'url')),
  required boolean not null default false,
  searchable boolean not null default false,
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  validation jsonb not null default '{}'::jsonb check (jsonb_typeof(validation) = 'object'),
  sort_order integer not null default 0,
  unique (form_definition_id, field_key)
);

create table if not exists public.db_records (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.db_categories(id) on delete restrict,
  record_type_id uuid not null references public.db_record_types(id) on delete restrict,
  form_definition_id uuid references public.db_form_definitions(id) on delete restrict,
  record_code text not null check (length(btrim(record_code)) between 1 and 120),
  title text not null check (length(btrim(title)) between 1 and 500),
  summary text,
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'approved', 'archived', 'deleted')),
  department_id uuid references public.departments(id) on delete restrict,
  owner_id uuid references public.staff_users(id) on delete set null,
  created_by uuid not null references public.staff_users(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  search_document tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (record_code)
);

create table if not exists public.db_record_files (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.db_records(id) on delete restrict,
  storage_backend text not null check (storage_backend in ('vps_private', 'supabase_private')),
  storage_key text not null unique check (length(btrim(storage_key)) between 1 and 500),
  original_name text not null check (length(btrim(original_name)) between 1 and 255),
  mime_type text not null check (length(btrim(mime_type)) between 1 and 160),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references public.staff_users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.db_record_external_links (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.db_records(id) on delete restrict,
  provider text not null check (provider = 'google_drive'),
  url text not null check (url ~ '^https://'),
  external_file_id text,
  media_kind text check (media_kind in ('image', 'audio', 'video')),
  usage_rights text,
  link_status text not null default 'unverified' check (link_status in ('unverified', 'active', 'expired', 'revoked', 'missing')),
  last_verified_at timestamptz,
  created_by uuid not null references public.staff_users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.db_record_keywords (
  record_id uuid not null references public.db_records(id) on delete restrict,
  keyword text not null check (length(btrim(keyword)) between 1 and 120),
  primary key (record_id, keyword)
);

create table if not exists public.db_record_relations (
  record_id uuid not null references public.db_records(id) on delete restrict,
  related_record_id uuid not null references public.db_records(id) on delete restrict,
  relation_type text not null check (length(btrim(relation_type)) between 1 and 80),
  primary key (record_id, related_record_id, relation_type),
  check (record_id <> related_record_id)
);

create table if not exists public.db_record_acl (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.db_records(id) on delete restrict,
  principal_type text not null check (principal_type in ('user', 'role', 'department')),
  principal_id uuid not null,
  capability text not null check (capability in ('discover', 'metadata.view', 'preview', 'download', 'edit', 'approve', 'delete', 'restore', 'export', 'acl.manage')),
  effect text not null check (effect in ('allow', 'deny')),
  granted_by uuid not null references public.staff_users(id) on delete restrict,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (record_id, principal_type, principal_id, capability)
);

create table if not exists public.db_record_history (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.db_records(id) on delete restrict,
  actor_id uuid not null references public.staff_users(id) on delete restrict,
  action text not null check (length(btrim(action)) between 1 and 80),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.db_saved_search_filters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.staff_users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 160),
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create index if not exists db_categories_parent_idx on public.db_categories(parent_id, sort_order);
create index if not exists db_categories_department_idx on public.db_categories(department_id, active);
create index if not exists db_record_types_category_idx on public.db_record_types(category_id, active);
create index if not exists db_form_fields_search_idx on public.db_form_fields(form_definition_id, searchable, sort_order);
create index if not exists db_records_type_status_idx on public.db_records(record_type_id, status, updated_at desc);
create index if not exists db_records_department_owner_idx on public.db_records(department_id, owner_id, updated_at desc);
create index if not exists db_records_search_idx on public.db_records using gin(search_document);
create index if not exists db_record_files_record_idx on public.db_record_files(record_id, created_at desc);
create index if not exists db_record_links_record_idx on public.db_record_external_links(record_id, link_status);
create index if not exists db_record_acl_lookup_idx on public.db_record_acl(record_id, capability, principal_type, principal_id, effect);
create index if not exists db_record_history_record_idx on public.db_record_history(record_id, created_at desc);
create index if not exists db_saved_search_owner_idx on public.db_saved_search_filters(owner_id, updated_at desc);

create or replace function public.db_records_search_document_update()
returns trigger language plpgsql as $function$
begin
  new.search_document := to_tsvector('simple', concat_ws(' ', new.record_code, new.title, new.summary, new.metadata::text));
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists db_records_search_document_trigger on public.db_records;
create trigger db_records_search_document_trigger
before insert or update of record_code, title, summary, metadata on public.db_records
for each row execute function public.db_records_search_document_update();

insert into public.permissions (code, name, module, description) values
  ('record.discover', 'Phát hiện hồ sơ', 'database', 'Biết hồ sơ tồn tại trong phạm vi được phép.'),
  ('record.metadata.view', 'Xem metadata hồ sơ', 'database', 'Xem metadata hồ sơ theo ACL.'),
  ('record.preview', 'Xem trước hồ sơ', 'database', 'Xem preview hồ sơ theo ACL.'),
  ('record.download', 'Tải hồ sơ', 'database', 'Tải file gốc theo ACL.'),
  ('record.create', 'Tạo hồ sơ', 'database', 'Tạo hồ sơ trong phạm vi được phép.'),
  ('record.edit', 'Sửa hồ sơ', 'database', 'Sửa metadata hồ sơ theo ACL.'),
  ('record.approve', 'Duyệt hồ sơ', 'database', 'Duyệt hồ sơ theo workflow.'),
  ('record.delete', 'Xóa mềm hồ sơ', 'database', 'Xóa mềm hồ sơ theo ACL.'),
  ('record.restore', 'Khôi phục hồ sơ', 'database', 'Khôi phục hồ sơ theo ACL.'),
  ('record.export', 'Xuất hồ sơ', 'database', 'Xuất dữ liệu hồ sơ theo ACL.'),
  ('record.acl.manage', 'Quản lý quyền hồ sơ', 'database', 'Quản lý ACL từng hồ sơ.')
on conflict (code) do update set name = excluded.name, module = excluded.module, description = excluded.description, updated_at = now();

do $grants$
begin
  -- Only the existing system administrator receives the broad foundation grants.
  insert into public.role_permission_grants (role_id, permission_id, scope)
  select r.id, p.id, 'all'
  from public.roles r cross join public.permissions p
  where r.code = 'admin' and p.module = 'database'
  on conflict (role_id, permission_id, scope) do nothing;
end
$grants$;

do $rls$
declare t text;
begin
  foreach t in array array['db_categories','db_record_types','db_form_definitions','db_form_fields','db_records','db_record_files','db_record_external_links','db_record_keywords','db_record_relations','db_record_acl','db_record_history','db_saved_search_filters'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
  end loop;
end
$rls$;

commit;

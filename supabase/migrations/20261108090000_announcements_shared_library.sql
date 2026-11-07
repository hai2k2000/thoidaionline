begin;
create table if not exists public.announcements (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(btrim(title)) between 1 and 200),
 body text not null check(length(btrim(body)) between 1 and 10000),
 important boolean not null default false,
 pinned boolean not null default false,
 expires_at timestamptz,
 created_by uuid not null references public.staff_users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 deleted_at timestamptz
);
create index if not exists announcements_list_idx on public.announcements(pinned desc,created_at desc) where deleted_at is null;
create table if not exists public.shared_library_folders (
 id uuid primary key default gen_random_uuid(),
 parent_id uuid references public.shared_library_folders(id),
 name text not null check(length(btrim(name)) between 1 and 250),
 system_key text unique,
 created_by uuid references public.staff_users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 deleted_at timestamptz
);
create unique index if not exists shared_library_folder_name_uq on public.shared_library_folders(
 coalesce(parent_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(name)
) where deleted_at is null;
create table if not exists public.shared_library_items (
 id uuid primary key default gen_random_uuid(),
 folder_id uuid not null references public.shared_library_folders(id),
 kind text not null check(kind in ('file','link')),
 title text not null check(length(btrim(title)) between 1 and 500),
 description text check(length(description)<=10000),
 storage_path text,
 file_name text,
 mime_type text,
 size_bytes bigint,
 url text,
 uploaded_by uuid not null references public.staff_users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 deleted_at timestamptz,
 check((kind='file' and nullif(storage_path,'') is not null and nullif(file_name,'') is not null
 and nullif(mime_type,'') is not null and size_bytes is not null and size_bytes>0 and url is null)
 or (kind='link' and url is not null and length(url)<=2000 and url ~* '^https?://'
 and storage_path is null))
);
create index if not exists shared_library_items_folder_idx on public.shared_library_items(folder_id,created_at desc) where deleted_at is null;
alter table public.announcements enable row level security;
alter table public.shared_library_folders enable row level security;
alter table public.shared_library_items enable row level security;
revoke all on table public.announcements from public,anon,authenticated;
revoke all on table public.shared_library_folders from public,anon,authenticated;
revoke all on table public.shared_library_items from public,anon,authenticated;
grant all on table public.announcements to service_role;
grant all on table public.shared_library_folders to service_role;
grant all on table public.shared_library_items to service_role;
commit;

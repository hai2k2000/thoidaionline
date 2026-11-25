begin;
create table public.announcement_images (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id),
  storage_path text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 5242880),
  width int,
  height int,
  position int not null default 0,
  created_by uuid not null references public.staff_users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index announcement_images_active_order_idx on public.announcement_images (announcement_id, position) where deleted_at is null;
alter table public.announcement_images enable row level security;
revoke all on table public.announcement_images from public, anon, authenticated;
grant all on table public.announcement_images to service_role;
notify pgrst, 'reload schema';
commit;

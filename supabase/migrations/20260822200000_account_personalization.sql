begin;

alter table public.staff_users
  add column if not exists avatar_path text,
  add column if not exists preferences jsonb not null default '{}'::jsonb;

alter table public.staff_users drop constraint if exists staff_users_preferences_object_check;
alter table public.staff_users add constraint staff_users_preferences_object_check
  check (jsonb_typeof(preferences) = 'object');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', false, 2097152,
  array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
commit;

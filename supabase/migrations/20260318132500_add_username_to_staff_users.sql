-- Add username for compatibility with UI queries and user management page
alter table public.staff_users add column if not exists username text;

-- Backfill username from email prefix for existing rows
update public.staff_users
set username = split_part(email, '@', 1)
where (username is null or username = '')
  and email is not null;

-- Keep username unique (case-insensitive), allow nulls
create unique index if not exists idx_staff_users_username_unique
  on public.staff_users (lower(username))
  where username is not null;

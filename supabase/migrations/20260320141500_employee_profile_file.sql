alter table if exists public.employee_profiles
  add column if not exists profile_file_url text;

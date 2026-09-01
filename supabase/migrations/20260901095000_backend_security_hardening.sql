begin;

-- The application authenticates with its own HMAC session cookie rather than a
-- Supabase Auth JWT. Browser-side Supabase clients therefore always run as
-- anon and must not have direct access to business data. Server routes use the
-- service_role client after checking the application session.
do $hardening$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'employee_profiles', 'assets', 'asset_assignments', 'official_documents',
    'document_assignments', 'work_schedules', 'password_reset_tokens',
    'password_reset_attempts'
  ] loop
    if to_regclass(format('public.%I', table_name)) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);

    for policy_name in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = table_name
    loop
      execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    end loop;
  end loop;
end
$hardening$;

-- Remove the legacy public task-files bucket and its anon object policies. The
-- canonical task-private bucket is already private and size/MIME constrained.
update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array[
      'application/pdf', 'image/png', 'image/jpeg',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
where id = 'task-files';

drop policy if exists "public read task-files" on storage.objects;
drop policy if exists "public write task-files" on storage.objects;

revoke all privileges on table storage.objects from anon, authenticated;
revoke all privileges on table storage.buckets from anon, authenticated;

commit;

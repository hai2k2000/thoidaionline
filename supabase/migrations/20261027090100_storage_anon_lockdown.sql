-- Part B of C-01. Must run as supabase_admin (or supabase_storage_admin):
-- storage.objects/buckets are owned by supabase_storage_admin, so the same
-- statements run as postgres only emit "no privileges could be revoked"
-- warnings and cannot drop the policies. This is why the storage half of
-- 20260901095000_backend_security_hardening.sql would not have worked as postgres.
-- Current production: bucket task-files is public, storage.objects is empty.
-- The app signs/reads avatars server-side with service_role (all
-- /supa/storage requests in 14 days of Nginx logs came from the VPS itself).
begin;

set local lock_timeout = '5s';

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

do $assert$
begin
  if exists (select 1 from storage.buckets where public) then
    raise exception 'C-01B: public storage bucket remains';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and ('anon' = any(roles) or 'public' = any(roles))) then
    raise exception 'C-01B: anon storage policy remains';
  end if;
  if has_table_privilege('anon', 'storage.objects', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'C-01B: anon still has storage.objects privileges';
  end if;
end
$assert$;

commit;

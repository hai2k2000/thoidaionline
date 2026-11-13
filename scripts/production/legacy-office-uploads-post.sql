-- Run in the same connection as the pre-apply TEMP snapshots.
do $$
declare additions text[] := array['application/msword','application/vnd.ms-excel','application/vnd.ms-powerpoint'];
begin
  if (select count(*) from storage.buckets where id in ('task-private','task-files')) <> 2
     or exists(select 1 from storage.buckets where id in ('task-private','task-files')
       and allowed_mime_types is not null and not (allowed_mime_types @> additions)) then
    raise exception 'Affected buckets do not contain the three legacy MIME types';
  end if;
  if exists (
    select 1 from storage.buckets b full join legacy_office_bucket_before old using(id)
    where b.id is null or old.id is null
       or (to_jsonb(b)-'allowed_mime_types') is distinct from (to_jsonb(old)-'allowed_mime_types')
       or b.allowed_mime_types is distinct from (
         case when old.id in ('task-private','task-files') and old.allowed_mime_types is not null
         then old.allowed_mime_types || array(select m from unnest(additions) m where not(m=any(old.allowed_mime_types)))
         else old.allowed_mime_types end)
  ) then raise exception 'Bucket fields changed beyond missing legacy MIME additions'; end if;
  if exists (
    select 1 from legacy_office_functions_before old join pg_proc p on p.oid=old.oid
    where p.proacl is distinct from old.proacl or p.proowner<>old.proowner
      or p.prosecdef is distinct from old.prosecdef or p.proconfig is distinct from old.proconfig
      or pg_get_functiondef(p.oid) is distinct from replace(old.definition,
        '''application/pdf'',''image/png'',''image/jpeg'',''application/vnd.openxmlformats-officedocument.wordprocessingml.document'',''application/vnd.openxmlformats-officedocument.spreadsheetml.sheet''',
        '''application/pdf'',''image/png'',''image/jpeg'',''application/vnd.openxmlformats-officedocument.wordprocessingml.document'',''application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'',''application/msword'',''application/vnd.ms-excel''')
  ) then raise exception 'Unexpected function or ACL change'; end if;
  if exists(select 1 from pg_policies where schemaname='storage' and roles && array['anon','authenticated','public']::name[])
     or has_table_privilege('anon','storage.buckets','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('anon','storage.objects','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','storage.objects','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','storage.buckets','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Storage ACL lockdown failed';
  end if;
end $$;

-- Requires the pre-apply snapshot in this same session (see the disposable dry-run).
-- Restore only MIME arrays and the two function definitions; never remove uploaded files.
begin;
do $$ begin
  if to_regclass('pg_temp.legacy_office_bucket_before') is null
     or to_regclass('pg_temp.legacy_office_functions_before') is null then
    raise exception 'Pre-apply legacy Office snapshot required';
  end if;
end $$;
update storage.buckets b set allowed_mime_types = old.allowed_mime_types
from pg_temp.legacy_office_bucket_before old
where b.id = old.id and b.id in ('task-private','task-files')
  and b.allowed_mime_types is distinct from old.allowed_mime_types;
do $$ declare f record; begin
  for f in select definition from pg_temp.legacy_office_functions_before loop
    execute f.definition;
  end loop;
end $$;
notify pgrst,'reload schema';
commit;

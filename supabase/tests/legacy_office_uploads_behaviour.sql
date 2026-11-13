\set ON_ERROR_STOP on
-- Synthetic metadata only; never inspect or restore user file bytes.
create temp table legacy_office_bucket_before as select * from storage.buckets;
create temp table legacy_office_functions_before as
select oid,proacl,proowner,prosecdef,proconfig,pg_get_functiondef(oid) definition from pg_proc
where oid in ('public.api_add_task_attachment(uuid,uuid,text,text,text,bigint)'::regprocedure,
 'public.api_add_project_library_item(uuid,uuid,uuid,text,text,text,text,text,text,text,bigint)'::regprocedure);
do $$ begin
 if (select count(*) from legacy_office_functions_before)<>2
    or (select count(*) from storage.buckets where id in ('task-private','task-files'))<>2 then
   raise exception 'Restore prerequisites missing';
 end if;
end $$;
\ir ../migrations/20261112140000_allow_legacy_office_uploads.sql
\ir ../migrations/20261112140100_legacy_office_metadata_validation.sql
\ir ../../scripts/production/legacy-office-uploads-post.sql
create temp table legacy_office_bucket_applied as select * from storage.buckets;
\ir ../migrations/20261112140000_allow_legacy_office_uploads.sql
\ir ../migrations/20261112140100_legacy_office_metadata_validation.sql
\ir ../../scripts/production/legacy-office-uploads-post.sql
do $$ begin
 if exists(select * from storage.buckets except select * from legacy_office_bucket_applied)
    or exists(select * from legacy_office_bucket_applied except select * from storage.buckets) then
   raise exception 'Reapply was not idempotent';
 end if;
end $$;
\ir ../../scripts/production/legacy-office-uploads-revert.sql
do $$ begin
 if exists(select * from storage.buckets except select * from legacy_office_bucket_before)
    or exists(select * from legacy_office_bucket_before except select * from storage.buckets)
    or exists(select 1 from legacy_office_functions_before old join pg_proc p on p.oid=old.oid
      where pg_get_functiondef(p.oid)<>old.definition or p.proacl is distinct from old.proacl or p.proowner<>old.proowner) then
   raise exception 'Revert did not restore pre-apply state';
 end if;
end $$;
\ir ../migrations/20261112140000_allow_legacy_office_uploads.sql
\ir ../migrations/20261112140100_legacy_office_metadata_validation.sql
\ir ../../scripts/production/legacy-office-uploads-post.sql
select 'LEGACY_OFFICE_UPLOADS_BEHAVIOUR=PASS';

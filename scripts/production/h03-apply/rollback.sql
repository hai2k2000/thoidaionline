begin;

drop trigger if exists audit_direct_assignment_start on public.tasks;
drop trigger if exists journalism_publication_reports_set_updated_at on public.journalism_publication_reports;
drop trigger if exists editorial_topic_tasks_journalism_task_guard on public.editorial_topic_tasks;
drop trigger if exists editorial_series_items_journalism_task_guard on public.editorial_series_items;
drop trigger if exists editorial_series_topic_compatibility_guard on public.editorial_series;
drop trigger if exists editorial_topic_series_compatibility_guard on public.editorial_topics;
drop trigger if exists editorial_topics_set_updated_at on public.editorial_topics;
drop trigger if exists editorial_series_set_updated_at on public.editorial_series;
drop trigger if exists editorial_series_items_set_updated_at on public.editorial_series_items;

do $$
declare
  r record;
  names text[] := array[
    'audit_direct_assignment_start','api_assign_task_batch_v1','api_assert_journalism_access',
    'api_assign_journalism_task_v1','api_update_journalism_metadata_v1','api_change_journalism_publication_v1',
    'api_assert_journalism_department_scope','api_assert_journalism_structure_scope','api_register_journalism_task_v1',
    'assert_journalism_structure_task','assert_editorial_series_topic_compatibility','touch_editorial_structure_updated_at',
    'api_create_editorial_topic_v1','api_update_editorial_topic_v1','api_archive_editorial_topic_v1',
    'api_create_editorial_series_v1','api_update_editorial_series_v1','api_archive_editorial_series_v1',
    'api_j5d_assert_assign','api_j5d_assert_manage_series','api_attach_editorial_topic_task_v1',
    'api_detach_editorial_topic_task_v1','api_attach_editorial_series_task_v1','api_detach_editorial_series_task_v1',
    'api_reorder_editorial_series_v1','api_upsert_journalism_publication_report_v1',
    'api_record_journalism_publication_verification_v1','api_reconcile_journalism_publication_report_v1'
  ];
begin
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=any(names)
  loop execute format('drop function %s', r.oid::regprocedure); end loop;
end $$;

drop table if exists public.editorial_topic_tasks;
drop table if exists public.editorial_series_items;
drop table if exists public.journalism_publication_verifications;
drop table if exists public.journalism_publication_reports;
drop table if exists public.editorial_series;
drop table if exists public.editorial_topics;
drop table if exists public.task_assignment_batch_idempotency;

delete from public.role_permission_grants g using public.permissions p
where g.permission_id=p.id and p.code in ('journalism.metadata.update','journalism.publication.manage','journalism.structure.manage','journalism.structure.assign','journalism.publication.verify');
delete from public.permissions where code in ('journalism.metadata.update','journalism.publication.manage','journalism.structure.manage','journalism.structure.assign','journalism.publication.verify');
delete from supabase_migrations.schema_migrations where version in ('20261027120000','20261027120100','20260925110000','20260925111000','20260918120000','20260918130000','20260918140000','20260918150000','20260919110000','20260919120000','20260922120000','20260922123000','20260922130000','20260923110000','20260923150000','20260925100000');

commit;

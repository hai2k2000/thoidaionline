begin;

drop trigger if exists audit_direct_assignment_start on public.tasks;
drop function if exists public.audit_direct_assignment_start();

drop function if exists public.api_register_journalism_task_v1(uuid,text,text,uuid,date,time,text,uuid,timestamptz,text,text);
drop function if exists public.api_assert_journalism_department_scope(uuid,uuid);
drop function if exists public.api_reconcile_journalism_publication_report_v1(uuid,uuid,text,text,timestamptz,text,timestamptz,text);
drop function if exists public.api_assign_journalism_task_v1(uuid,text,text,uuid,uuid,uuid,date,time without time zone,text,text,uuid[],uuid[],uuid,timestamp with time zone,text,text);
alter function public.api_assign_journalism_task_v1_unscoped(uuid,text,text,uuid,uuid,uuid,date,time without time zone,text,text,uuid[],uuid[],uuid,timestamp with time zone,text,text)
  rename to api_assign_journalism_task_v1;
drop function if exists public.api_assert_journalism_access(uuid,uuid,text);
drop function if exists public.api_update_journalism_metadata_v1(uuid,uuid,uuid,timestamptz,text,text,timestamptz);
drop function if exists public.api_change_journalism_publication_v1(uuid,uuid,text,timestamptz,text,text);
drop function if exists public.api_assert_journalism_structure_scope(uuid,text,uuid);
drop function if exists public.api_create_editorial_topic_v1(uuid,text,text,uuid);
drop function if exists public.api_update_editorial_topic_v1(uuid,uuid,text,text,boolean,boolean);
drop function if exists public.api_archive_editorial_topic_v1(uuid,uuid);
drop function if exists public.api_create_editorial_series_v1(uuid,text,text,uuid,uuid);
drop function if exists public.api_update_editorial_series_v1(uuid,uuid,text,text,uuid,boolean,boolean,boolean);
drop function if exists public.api_archive_editorial_series_v1(uuid,uuid);
drop function if exists public.api_j5d_assert_assign(uuid,uuid,uuid);
drop function if exists public.api_j5d_assert_manage_series(uuid,uuid,uuid);
drop function if exists public.api_attach_editorial_topic_task_v1(uuid,uuid,uuid);
drop function if exists public.api_detach_editorial_topic_task_v1(uuid,uuid,uuid);
drop function if exists public.api_attach_editorial_series_task_v1(uuid,uuid,uuid);
drop function if exists public.api_detach_editorial_series_task_v1(uuid,uuid,uuid);
drop function if exists public.api_reorder_editorial_series_v1(uuid,uuid,uuid[]);
drop function if exists public.api_upsert_journalism_publication_report_v1(uuid,uuid,text,text,timestamptz,text,timestamptz);
drop function if exists public.api_record_journalism_publication_verification_v1(uuid,uuid,text,text,timestamptz);
drop function if exists public.api_assign_task_batch_v1(uuid,uuid,uuid,uuid,jsonb);
drop function if exists public.assert_journalism_structure_task();
drop function if exists public.assert_editorial_series_topic_compatibility();
drop function if exists public.touch_editorial_structure_updated_at();

drop table if exists public.journalism_publication_verifications;
drop table if exists public.journalism_publication_reports;
drop table if exists public.editorial_series_items;
drop table if exists public.editorial_topic_tasks;
drop table if exists public.editorial_series;
drop table if exists public.editorial_topics;
drop table if exists public.task_assignment_batch_idempotency;

delete from public.role_permission_grants g using public.permissions p
where g.permission_id=p.id and p.code in (
  'journalism.metadata.update','journalism.publication.manage',
  'journalism.structure.manage','journalism.structure.assign',
  'journalism.publication.verify'
);
delete from public.permissions where code in (
  'journalism.metadata.update','journalism.publication.manage',
  'journalism.structure.manage','journalism.structure.assign',
  'journalism.publication.verify'
);

delete from supabase_migrations.schema_migrations
where version in ('20261027120000','20260925110000','20260925111000','20260918120000','20260918130000','20260918140000','20260918150000','20260919110000','20260919120000','20260922120000','20260922123000','20260922130000','20260923110000','20260923150000','20260925100000');

commit;

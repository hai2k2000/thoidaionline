do $$
declare
  v_count bigint;
  v_name text;
  names text[] := array[
    'audit_direct_assignment_start','api_assign_task_batch_v1','api_assert_journalism_access','api_assign_journalism_task_v1',
    'api_update_journalism_metadata_v1','api_change_journalism_publication_v1','api_assert_journalism_department_scope',
    'api_assert_journalism_structure_scope','api_register_journalism_task_v1','assert_journalism_structure_task',
    'assert_editorial_series_topic_compatibility','touch_editorial_structure_updated_at','api_create_editorial_topic_v1',
    'api_update_editorial_topic_v1','api_archive_editorial_topic_v1','api_create_editorial_series_v1',
    'api_update_editorial_series_v1','api_archive_editorial_series_v1','api_j5d_assert_assign','api_j5d_assert_manage_series',
    'api_attach_editorial_topic_task_v1','api_detach_editorial_topic_task_v1','api_attach_editorial_series_task_v1',
    'api_detach_editorial_series_task_v1','api_reorder_editorial_series_v1','api_upsert_journalism_publication_report_v1',
    'api_record_journalism_publication_verification_v1','api_reconcile_journalism_publication_report_v1'
  ];
begin
  select count(*) into v_count from supabase_migrations.schema_migrations;
  if v_count not in (133,167) then raise exception 'expected ledger count 133 or 167, found %', v_count; end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(array[
    'task_assignment_batch_idempotency','editorial_topics','editorial_series','editorial_topic_tasks','editorial_series_items',
    'journalism_publication_reports','journalism_publication_verifications','task_assignment_batch_idempotency_created_at_idx',
    'editorial_topics_active_global_name_unique','editorial_topics_active_department_name_unique','editorial_series_active_global_name_unique',
    'editorial_series_active_department_name_unique','editorial_topics_department_active_idx','editorial_series_topic_idx',
    'editorial_series_department_active_idx','editorial_topic_tasks_task_idx','editorial_series_items_series_position_idx',
    'journalism_publication_reports_published_at_idx','journalism_publication_reports_reported_by_idx',
    'journalism_publication_verifications_report_created_idx','journalism_publication_verifications_report_version_idx'
  ])) then raise exception 'migration-owned table or index exists'; end if;
  foreach v_name in array names loop
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=v_name) then raise exception 'migration-owned function exists: %', v_name; end if;
  end loop;
  if exists (select 1 from pg_trigger where not tgisinternal and tgname=any(array[
    'audit_direct_assignment_start','journalism_publication_reports_set_updated_at','editorial_topic_tasks_journalism_task_guard',
    'editorial_series_items_journalism_task_guard','editorial_series_topic_compatibility_guard','editorial_topic_series_compatibility_guard',
    'editorial_topics_set_updated_at','editorial_series_set_updated_at','editorial_series_items_set_updated_at'
  ])) then raise exception 'migration-owned trigger exists'; end if;
  if exists (select 1 from public.permissions where code=any(array['journalism.metadata.update','journalism.publication.manage','journalism.structure.manage','journalism.structure.assign','journalism.publication.verify'])) then raise exception 'migration-owned permission exists'; end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version=any(array['20261027120000','20260925110000','20260925111000','20260918120000','20260918130000','20260918140000','20260918150000','20260919110000','20260919120000','20260922120000','20260922123000','20260922130000','20260923110000','20260923150000','20260925100000'])) then raise exception 'migration ledger row exists'; end if;
end $$;

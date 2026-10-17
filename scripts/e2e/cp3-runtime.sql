\set ON_ERROR_STOP on

-- Synthetic CP3 fixture. It never references production identifiers or data.
begin;

insert into public.role_permission_grants (role_id, permission_id, scope)
select '20000000-0000-4000-8000-000000000002', id, 'all'
from public.permissions
where code in ('record.discover', 'record.metadata.view', 'record.create', 'record.edit', 'record.download', 'record.export', 'record.delete', 'record.restore', 'record.acl.manage')
on conflict (role_id, permission_id, scope) do nothing;

with refs as (
  select
    (select id from public.db_categories where code = 'tong_hop') as category_id,
    (select id from public.db_record_types where code = 'bao_cao') as normal_type_id,
    (select id from public.db_record_types where code = 'ho_so_dang') as sensitive_type_id,
    (select id from public.db_form_definitions f join public.db_record_types t on t.id = f.record_type_id where t.code = 'bao_cao' and f.version = 1) as normal_form_id,
    (select id from public.db_form_definitions f join public.db_record_types t on t.id = f.record_type_id where t.code = 'ho_so_dang' and f.version = 1) as sensitive_form_id,
    '10000000-0000-4000-8000-000000000001'::uuid as employee_department,
    '10000000-0000-4000-8000-000000000002'::uuid as other_department
)
insert into public.db_records (id, category_id, record_type_id, form_definition_id, record_code, title, summary, status, department_id, owner_id, created_by, metadata)
select v.id, r.category_id, case when v.sensitive then r.sensitive_type_id else r.normal_type_id end, case when v.sensitive then r.sensitive_form_id else r.normal_form_id end,
  v.record_code, v.title, v.summary, 'approved', case when v.other_department then r.other_department else r.employee_department end, v.owner_id, '30000000-0000-4000-8000-000000000001'::uuid, v.metadata
from refs r
cross join (values
  ('60000000-0000-4000-8000-000000000001'::uuid, 'CP3-ALLOW', 'alpha visible', 'visible summary', false, false, '30000000-0000-4000-8000-000000000002'::uuid, '{"subject":"alpha beta"}'::jsonb),
  ('60000000-0000-4000-8000-000000000002'::uuid, 'CP3-DENY', 'alpha denied', 'secret summary', false, false, '30000000-0000-4000-8000-000000000001'::uuid, '{"subject":"alpha hidden"}'::jsonb),
  ('60000000-0000-4000-8000-000000000003'::uuid, 'CP3-EXPIRED', 'gamma expired', 'expired summary', true, false, '30000000-0000-4000-8000-000000000001'::uuid, '{"subject":"gamma"}'::jsonb),
  ('60000000-0000-4000-8000-000000000004'::uuid, 'CP3-SENSITIVE', 'sensitive hidden', 'sensitive summary', false, true, '30000000-0000-4000-8000-000000000001'::uuid, '{"subject":"restricted"}'::jsonb),
  ('60000000-0000-4000-8000-000000000005'::uuid, 'CP3-DEPT', 'alpha department', 'department summary', false, false, '30000000-0000-4000-8000-000000000001'::uuid, '{"subject":"alpha department"}'::jsonb)
) as v(id, record_code, title, summary, other_department, sensitive, owner_id, metadata)
on conflict (id) do update set title = excluded.title, summary = excluded.summary, metadata = excluded.metadata, status = excluded.status;

insert into public.db_record_acl (record_id, principal_type, principal_id, capability, effect, granted_by, expires_at)
values
  ('60000000-0000-4000-8000-000000000002', 'user', '30000000-0000-4000-8000-000000000002', 'discover', 'deny', '30000000-0000-4000-8000-000000000001', null),
  ('60000000-0000-4000-8000-000000000003', 'user', '30000000-0000-4000-8000-000000000002', 'discover', 'allow', '30000000-0000-4000-8000-000000000001', now() - interval '1 minute'),
  ('60000000-0000-4000-8000-000000000001', 'user', '30000000-0000-4000-8000-000000000002', 'metadata.view', 'deny', '30000000-0000-4000-8000-000000000001', null)
on conflict (record_id, principal_type, principal_id, capability) do update set effect = excluded.effect, expires_at = excluded.expires_at;

do $$
declare
  row_count integer;
  total_count bigint;
  visible_ids uuid[];
  search_ids uuid[];
begin
  select count(*), max(total_count), array_agg(id order by id)
    into row_count, total_count, visible_ids
  from public.api_search_database_records('30000000-0000-4000-8000-000000000002', null, null, null, null, 100, 0);
  if row_count <> 2 or total_count <> 2 or visible_ids <> array['60000000-0000-4000-8000-000000000001'::uuid, '60000000-0000-4000-8000-000000000005'::uuid] then
    raise exception 'CP3 ACL visibility failed: %, %, %', row_count, total_count, visible_ids;
  end if;

  select array_agg(id order by id) into search_ids
  from public.api_search_database_records('30000000-0000-4000-8000-000000000002', 'alpha -hidden', null, null, null, 10, 0);
  if search_ids <> array['60000000-0000-4000-8000-000000000001'::uuid, '60000000-0000-4000-8000-000000000005'::uuid] then raise exception 'CP3 NOT search failed'; end if;

  select array_agg(id order by id) into search_ids
  from public.api_search_database_records('30000000-0000-4000-8000-000000000002', 'alpha OR gamma', null, null, null, 10, 0);
  if search_ids <> array['60000000-0000-4000-8000-000000000001'::uuid, '60000000-0000-4000-8000-000000000005'::uuid] then raise exception 'CP3 OR/expired search failed'; end if;

  select (summary is null)::int, (metadata = '{}'::jsonb)::int into row_count, total_count
  from public.api_search_database_records('30000000-0000-4000-8000-000000000002', 'beta', null, null, null, 1, 0);
  if row_count <> 1 or total_count <> 1 then raise exception 'CP3 metadata side-channel failed'; end if;

  if exists (select 1 from public.api_search_database_records('30000000-0000-4000-8000-000000000002', 'restricted', null, null, null, 10, 0)) then raise exception 'CP3 sensitive record leaked'; end if;
end $$;

select
  'CP3_RUNTIME_PASS' as status,
  (select count(*) from public.db_record_types where active) as active_record_types,
  (select count(*) from public.db_form_definitions where status = 'published') as published_forms,
  has_function_privilege('service_role', 'public.api_search_database_records(uuid,text,text,uuid,uuid,integer,integer)', 'execute') as service_role_execute,
  coalesce((select relrowsecurity from pg_class where oid = 'public.db_records'::regclass), false) as db_records_rls,
  has_table_privilege('anon', 'public.db_records', 'select') as anon_select,
  has_table_privilege('authenticated', 'public.db_records', 'select') as authenticated_select;

rollback;

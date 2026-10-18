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
    (select f.id from public.db_form_definitions f join public.db_record_types t on t.id = f.record_type_id where t.code = 'bao_cao' and f.version = 1) as normal_form_id,
    (select f.id from public.db_form_definitions f join public.db_record_types t on t.id = f.record_type_id where t.code = 'ho_so_dang' and f.version = 1) as sensitive_form_id,
    '10000000-0000-4000-8000-000000000001'::uuid as employee_department,
    '10000000-0000-4000-8000-000000000002'::uuid as other_department
)
insert into public.db_records (id, category_id, record_type_id, form_definition_id, record_code, title, summary, status, department_id, owner_id, created_by, metadata)
select v.id, r.category_id, case when v.sensitive then r.sensitive_type_id else r.normal_type_id end, case when v.sensitive then r.sensitive_form_id else r.normal_form_id end,
  v.record_code, v.title, v.summary, 'approved', case when v.other_department then r.other_department else r.employee_department end, v.owner_id, '30000000-0000-4000-8000-000000000001'::uuid, v.metadata
from refs r
cross join (values
  ('60000000-0000-4000-8000-000000000001'::uuid, 'CP3-ALLOW', 'alpha visible', 'summaryhidden summary', false, false, '30000000-0000-4000-8000-000000000002'::uuid, '{"keywords":"deny_only_token"}'::jsonb),
  ('60000000-0000-4000-8000-000000000002'::uuid, 'CP3-DENY', 'alpha denied', 'secret summary', false, false, '30000000-0000-4000-8000-000000000001'::uuid, '{"keywords":"alpha hidden"}'::jsonb),
  ('60000000-0000-4000-8000-000000000003'::uuid, 'CP3-EXPIRED', 'gamma expired', 'expired summary', true, false, '30000000-0000-4000-8000-000000000001'::uuid, '{"keywords":"gamma"}'::jsonb),
  ('60000000-0000-4000-8000-000000000004'::uuid, 'CP3-SENSITIVE', 'sensitive hidden', 'sensitive summary', false, true, '30000000-0000-4000-8000-000000000001'::uuid, '{"keywords":"restricted-ho-so-dang"}'::jsonb),
  ('60000000-0000-4000-8000-000000000005'::uuid, 'CP3-DEPT', 'alpha department', 'department summary', false, false, '30000000-0000-4000-8000-000000000001'::uuid, '{"keywords":"alpha department"}'::jsonb),
  ('60000000-0000-4000-8000-000000000006'::uuid, 'CP3-META', 'metadata visible', 'public summary', false, false, '30000000-0000-4000-8000-000000000001'::uuid, '{"keywords":"allow_only_token"}'::jsonb)
) as v(id, record_code, title, summary, other_department, sensitive, owner_id, metadata)
on conflict (id) do update set title = excluded.title, summary = excluded.summary, metadata = excluded.metadata, status = excluded.status;

insert into public.db_records (id, category_id, record_type_id, form_definition_id, record_code, title, summary, status, department_id, owner_id, created_by, metadata)
select v.id, c.id, t.id, f.id, v.record_code, v.title, 'sensitive summary', 'approved',
  '10000000-0000-4000-8000-000000000001'::uuid,
  '30000000-0000-4000-8000-000000000001'::uuid,
  '30000000-0000-4000-8000-000000000001'::uuid,
  '{}'::jsonb
from (values
  ('chi_hoi_nha_bao', '60000000-0000-4000-8000-000000000007'::uuid, 'CP3-SENSITIVE-CHI-HOI', 'restricted-chi-hoi-nha-bao'),
  ('doan_thanh_nien', '60000000-0000-4000-8000-000000000008'::uuid, 'CP3-SENSITIVE-DOAN', 'restricted-doan-thanh-nien'),
  ('giay_phep_quan_ly_bao_chi', '60000000-0000-4000-8000-000000000009'::uuid, 'CP3-SENSITIVE-GIAY-PHEP', 'restricted-giay-phep-quan-ly-bao-chi')
) as v(type_code, id, record_code, title)
join public.db_categories as c on c.code = 'doan_the_quan_ly'
join public.db_record_types as t on t.code = v.type_code and t.active = true
join public.db_form_definitions as f on f.record_type_id = t.id and f.version = 1 and f.status = 'published'
on conflict (id) do update set title = excluded.title, summary = excluded.summary, status = excluded.status;

insert into public.db_record_acl (record_id, principal_type, principal_id, capability, effect, granted_by, expires_at)
values
  ('60000000-0000-4000-8000-000000000002', 'user', '30000000-0000-4000-8000-000000000002', 'discover', 'deny', '30000000-0000-4000-8000-000000000001', null),
  ('60000000-0000-4000-8000-000000000003', 'user', '30000000-0000-4000-8000-000000000002', 'discover', 'allow', '30000000-0000-4000-8000-000000000001', now() - interval '1 minute'),
  ('60000000-0000-4000-8000-000000000005', 'user', '30000000-0000-4000-8000-000000000002', 'discover', 'allow', '30000000-0000-4000-8000-000000000001', null),
  ('60000000-0000-4000-8000-000000000006', 'user', '30000000-0000-4000-8000-000000000002', 'discover', 'allow', '30000000-0000-4000-8000-000000000001', null),
  ('60000000-0000-4000-8000-000000000001', 'user', '30000000-0000-4000-8000-000000000002', 'metadata.view', 'deny', '30000000-0000-4000-8000-000000000001', null),
  ('60000000-0000-4000-8000-000000000006', 'user', '30000000-0000-4000-8000-000000000002', 'metadata.view', 'allow', '30000000-0000-4000-8000-000000000001', null)
on conflict (record_id, principal_type, principal_id, capability) do update set effect = excluded.effect, expires_at = excluded.expires_at;

do $$
begin
  if (select count(*) from public.db_records where id in (
    '60000000-0000-4000-8000-000000000004'::uuid,
    '60000000-0000-4000-8000-000000000007'::uuid,
    '60000000-0000-4000-8000-000000000008'::uuid,
    '60000000-0000-4000-8000-000000000009'::uuid
  )) <> 4 then
    raise exception 'CP3 sensitive precondition failed: expected 4 record IDs';
  end if;
  if (select count(*) from public.db_records r join public.db_record_types t on t.id = r.record_type_id
      where r.id in (
        '60000000-0000-4000-8000-000000000004'::uuid,
        '60000000-0000-4000-8000-000000000007'::uuid,
        '60000000-0000-4000-8000-000000000008'::uuid,
        '60000000-0000-4000-8000-000000000009'::uuid
      ) and t.code in ('ho_so_dang', 'chi_hoi_nha_bao', 'doan_thanh_nien', 'giay_phep_quan_ly_bao_chi')) <> 4 then
    raise exception 'CP3 sensitive precondition failed: expected 4 record type codes';
  end if;
  if exists (
    select 1
    from (values
      ('60000000-0000-4000-8000-000000000004'::uuid, 'ho_so_dang', 'restricted-ho-so-dang'),
      ('60000000-0000-4000-8000-000000000007'::uuid, 'chi_hoi_nha_bao', 'restricted-chi-hoi-nha-bao'),
      ('60000000-0000-4000-8000-000000000008'::uuid, 'doan_thanh_nien', 'restricted-doan-thanh-nien'),
      ('60000000-0000-4000-8000-000000000009'::uuid, 'giay_phep_quan_ly_bao_chi', 'restricted-giay-phep-quan-ly-bao-chi')
    ) as expected(record_id, type_code, token)
    where not exists (
      select 1
      from public.db_records r
      join public.db_record_types t on t.id = r.record_type_id
      where r.id = expected.record_id
        and t.code = expected.type_code
        and position(expected.token in concat_ws(' ', r.record_code, r.title, r.summary, r.metadata::text)) > 0
    )
  ) then
    raise exception 'CP3 sensitive precondition failed: token does not match seeded record';
  end if;
end $$;

do $$
declare
  row_count integer;
  v_total_count bigint;
  visible_ids uuid[];
  search_ids uuid[];
  sensitive_row record;
begin
  select count(*), max(sr.total_count), array_agg(sr.id order by sr.id)
    into row_count, v_total_count, visible_ids
  from public.api_search_database_records('30000000-0000-4000-8000-000000000002', null, null, null, null, 100, 0) as sr;
  if row_count <> 3 or v_total_count <> 3 then
    raise exception 'CP3 ACL visibility failed: %, %, %', row_count, v_total_count, visible_ids;
  end if;

  select array_agg(sr.id order by sr.id) into search_ids
  from public.api_search_database_records('30000000-0000-4000-8000-000000000002', 'alpha -hidden', null, null, null, 10, 0) as sr;
  if search_ids is distinct from array['60000000-0000-4000-8000-000000000001'::uuid, '60000000-0000-4000-8000-000000000005'::uuid] then raise exception 'CP3 NOT search failed'; end if;

  select array_agg(sr.id order by sr.id) into search_ids
  from public.api_search_database_records('30000000-0000-4000-8000-000000000002', 'alpha OR gamma', null, null, null, 10, 0) as sr;
  if search_ids is distinct from array['60000000-0000-4000-8000-000000000001'::uuid, '60000000-0000-4000-8000-000000000005'::uuid] then raise exception 'CP3 OR/expired search failed'; end if;

  select count(*), coalesce(max(sr.total_count), 0) into row_count, v_total_count
  from public.api_search_database_records('30000000-0000-4000-8000-000000000002', 'deny_only_token', null, null, null, 10, 0) as sr;
  if row_count <> 0 or v_total_count <> 0 then raise exception 'CP3 denied metadata side-channel leaked'; end if;

  select array_agg(sr.id order by sr.id), coalesce(max(sr.total_count), 0) into search_ids, v_total_count
  from public.api_search_database_records('30000000-0000-4000-8000-000000000002', 'allow_only_token', null, null, null, 10, 0) as sr;
  if search_ids is distinct from array['60000000-0000-4000-8000-000000000006'::uuid] or v_total_count <> 1 then raise exception 'CP3 allowed metadata search failed'; end if;

  select count(*), coalesce(max(sr.total_count), 0) into row_count, v_total_count
  from public.api_search_database_records('30000000-0000-4000-8000-000000000002', 'summaryhidden', null, null, null, 1, 0) as sr;
  if row_count <> 0 or v_total_count <> 0 then raise exception 'CP3 denied summary side-channel leaked'; end if;

  select count(*) into row_count
  from public.api_search_database_records('30000000-0000-4000-8000-000000000002', null, null, null, null, 1, 1) as sr;
  if row_count <> 1 then raise exception 'CP3 pagination failed'; end if;

  if exists (select 1 from public.api_search_database_records('30000000-0000-4000-8000-000000000002', 'restricted', null, null, null, 10, 0) as sr) then raise exception 'CP3 sensitive record leaked'; end if;

  for sensitive_row in select * from (values
    ('60000000-0000-4000-8000-000000000004'::uuid, 'restricted-ho-so-dang'),
    ('60000000-0000-4000-8000-000000000007'::uuid, 'restricted-chi-hoi-nha-bao'),
    ('60000000-0000-4000-8000-000000000008'::uuid, 'restricted-doan-thanh-nien'),
    ('60000000-0000-4000-8000-000000000009'::uuid, 'restricted-giay-phep-quan-ly-bao-chi')
  ) as sensitive(record_id, token) loop
    if exists (select 1 from public.api_search_database_records('30000000-0000-4000-8000-000000000002', sensitive_row.token, null, null, null, 10, 0) as sr where sr.id = sensitive_row.record_id) then
      raise exception 'CP3 sensitive record leaked for record ID % and token %', sensitive_row.record_id, sensitive_row.token;
    end if;
  end loop;

  begin
    perform public.api_search_database_records('00000000-0000-4000-8000-000000000099', null, null, null, null, 10, 0);
    raise exception 'CP3 invalid actor was accepted';
  exception when insufficient_privilege then
    null;
  end;
end $$;

do $$
begin
  if not has_function_privilege('service_role', 'public.api_search_database_records(uuid,text,text,uuid,uuid,integer,integer)', 'execute') then
    raise exception 'CP3 service-role execute grant missing';
  end if;
  if has_table_privilege('anon', 'public.db_records', 'select') or has_table_privilege('authenticated', 'public.db_records', 'select') then
    raise exception 'CP3 public table grant unexpectedly present';
  end if;
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

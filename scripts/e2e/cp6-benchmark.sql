\set ON_ERROR_STOP on

-- CP6 Phase 2 synthetic benchmark fixture. Run only against the disposable
-- database created by start-sandbox.sh; all identifiers are deterministic.
begin;

create temporary table cp6_benchmark_config (
  actor_id uuid not null,
  admin_id uuid not null,
  detail_record_id uuid not null,
  records_seeded integer not null,
  sensitive_seeded integer not null,
  filtered_expected integer not null
) on commit drop;

-- CP3 grants are rolled back; keep benchmark authorization self-contained.
insert into public.role_permission_grants (role_id, permission_id, scope)
select su.role_id, p.id, 'all'
from public.staff_users as su
cross join public.permissions as p
where su.username in ('e2e-employee', 'e2e-admin')
  and p.code in ('record.discover', 'record.metadata.view')
on conflict (role_id, permission_id, scope) do nothing;

insert into public.user_permission_grants (user_id, permission_id, effect, scope, created_by)
select su.id, p.id, 'allow', 'all', admin.id
from public.staff_users as su
cross join public.permissions as p
cross join lateral (select id from public.staff_users where username = 'e2e-admin') as admin
where su.username = 'e2e-admin'
  and p.code = 'record.sensitive.access'
on conflict (user_id, permission_id) do update
set effect = excluded.effect, scope = excluded.scope, updated_at = now();

with benchmark_departments as (
  insert into public.departments (id, code, name, active)
  select ('11000000-0000-4000-8000-' || lpad((n + 10)::text, 12, '0'))::uuid,
         'cp6-bench-' || n,
         'CP6 Benchmark Department ' || n,
         true
  from generate_series(1, 8) as g(n)
  on conflict (id) do update set active = excluded.active
  returning id
),
  refs as (
    select
      (select id from public.db_categories where code = 'tong_hop') as category_id,
      (select id from public.db_record_types where code = 'bao_cao') as normal_type_id,
      (select f.id from public.db_form_definitions f join public.db_record_types t on t.id = f.record_type_id where t.code = 'bao_cao' and f.version = 1) as normal_form_id,
      (select id from public.staff_users where username = 'e2e-admin') as admin_id,
      (select id from public.staff_users where username = 'e2e-employee') as employee_id
  )
insert into public.db_records (
  id, category_id, record_type_id, form_definition_id, record_code, title,
  summary, status, department_id, owner_id, created_by, metadata
)
select
  ('71000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  r.category_id,
  r.normal_type_id,
  r.normal_form_id,
  'CP6-BENCH-' || lpad(n::text, 5, '0'),
  'CP6 benchmark record ' || n
    || case when n % 13 = 0 then ' needle-filter' else '' end
    || case when n = 1 then ' cp6-index-probe-unique' else '' end,
  case when n % 17 = 0 then 'filtered benchmark record' else 'synthetic benchmark summary' end,
  case when n % 11 = 0 then 'pending_review' else 'approved' end,
  ('11000000-0000-4000-8000-' || lpad(((n - 1) % 8 + 11)::text, 12, '0'))::uuid,
  case when n % 2 = 0 then r.employee_id else r.admin_id end,
  r.admin_id,
  jsonb_build_object('benchmark_keyword', case when n % 13 = 0 then 'needle-filter' else 'synthetic' end, 'sequence', n)
from refs r
cross join generate_series(1, 10000) as g(n)
on conflict (id) do update set
  title = excluded.title,
  summary = excluded.summary,
  status = excluded.status,
  department_id = excluded.department_id,
  owner_id = excluded.owner_id,
  metadata = excluded.metadata;

with refs as (
  select
    (select id from public.db_categories where code = 'doan_the_quan_ly') as category_id,
    (select id from public.staff_users where username = 'e2e-admin') as admin_id
), sensitive_types as (
  select t.id as record_type_id, t.code,
         (select f.id from public.db_form_definitions f where f.record_type_id = t.id and f.version = 1) as form_definition_id,
         row_number() over (order by t.code) as rn
  from public.db_record_types t
  where t.code in ('ho_so_dang', 'chi_hoi_nha_bao', 'doan_thanh_nien', 'giay_phep_quan_ly_bao_chi')
)
insert into public.db_records (
  id, category_id, record_type_id, form_definition_id, record_code, title,
  summary, status, department_id, owner_id, created_by, metadata
)
select
  ('72000000-0000-4000-8000-' || lpad(rn::text, 12, '0'))::uuid,
  refs.category_id,
  s.record_type_id,
  s.form_definition_id,
  'CP6-BENCH-SENSITIVE-' || s.code,
  'CP6 benchmark sensitive ' || s.code || ' cp6-sensitive-' || s.code,
  'sensitive benchmark record cp6-sensitive-' || s.code,
  'approved',
  '10000000-0000-4000-8000-000000000001'::uuid,
  refs.admin_id,
  refs.admin_id,
  jsonb_build_object('sensitive_keyword', 'cp6-sensitive-' || s.code)
from refs cross join sensitive_types s
on conflict (id) do update set metadata = excluded.metadata, title = excluded.title;

insert into public.db_record_acl (record_id, principal_type, principal_id, capability, effect, granted_by)
select
  '71000000-0000-4000-8000-000000000001'::uuid,
  'user',
  ('73000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'discover',
  case when n <= 10 then 'deny' else 'allow' end,
  '30000000-0000-4000-8000-000000000001'::uuid
from generate_series(1, 20) as g(n)
on conflict (record_id, principal_type, principal_id, capability) do update set effect = excluded.effect;

insert into public.db_record_files (record_id, storage_backend, storage_key, original_name, mime_type, size_bytes, sha256, created_by)
select
  '71000000-0000-4000-8000-000000000001'::uuid,
  'vps_private',
  '71000000-0000-4000-8000-000000000001/bench-' || lpad(n::text, 2, '0') || '.pdf',
  'bench-' || lpad(n::text, 2, '0') || '.pdf',
  'application/pdf',
  128,
  md5('cp6-benchmark-file-' || n) || md5('cp6-benchmark-file-sha-' || n),
  '30000000-0000-4000-8000-000000000001'::uuid
from generate_series(1, 10) as g(n)
on conflict (storage_key) do nothing;

insert into cp6_benchmark_config(actor_id, admin_id, detail_record_id, records_seeded, sensitive_seeded, filtered_expected)
select
  (select id from public.staff_users where username = 'e2e-employee'),
  (select id from public.staff_users where username = 'e2e-admin'),
  '71000000-0000-4000-8000-000000000001'::uuid,
  (select count(*) from public.db_records where record_code like 'CP6-BENCH-%' and record_code not like 'CP6-BENCH-SENSITIVE-%'),
  (select count(*) from public.db_records where record_code like 'CP6-BENCH-SENSITIVE-%'),
  (select count(*) from public.db_records where record_code like 'CP6-BENCH-%' and record_code not like 'CP6-BENCH-SENSITIVE-%' and status = 'approved' and title like '%needle-filter%');

do $$
declare
  v_records integer;
  v_sensitive integer;
  v_filtered integer;
  v_acl integer;
  v_files integer;
begin
  select records_seeded, sensitive_seeded, filtered_expected into v_records, v_sensitive, v_filtered from cp6_benchmark_config;
  select count(*) into v_acl from public.db_record_acl where record_id = '71000000-0000-4000-8000-000000000001'::uuid;
  select count(*) into v_files from public.db_record_files where record_id = '71000000-0000-4000-8000-000000000001'::uuid;
  if v_records <> 10000 then raise exception 'CP6 benchmark expected 10000 normal records, got %', v_records; end if;
  if v_sensitive <> 4 then raise exception 'CP6 benchmark expected 4 sensitive records, got %', v_sensitive; end if;
  if v_filtered <= 0 then raise exception 'CP6 benchmark searchable fixture has no approved needle-filter records'; end if;
  if v_acl <> 20 then raise exception 'CP6 benchmark expected 20 ACL rows, got %', v_acl; end if;
  if v_files <> 10 then raise exception 'CP6 benchmark expected 10 file rows, got %', v_files; end if;
end $$;

do $$
declare
  v_missing integer;
begin
  select count(*) into v_missing
  from (values
    ('ho_so_dang', 'cp6-sensitive-ho_so_dang'),
    ('chi_hoi_nha_bao', 'cp6-sensitive-chi_hoi_nha_bao'),
    ('doan_thanh_nien', 'cp6-sensitive-doan_thanh_nien'),
    ('giay_phep_quan_ly_bao_chi', 'cp6-sensitive-giay_phep_quan_ly_bao_chi')
  ) as expected(type_code, token)
  where not exists (
    select 1
    from public.db_records as r
    join public.db_record_types as t on t.id = r.record_type_id
    where r.record_code like 'CP6-BENCH-SENSITIVE-%'
      and t.code = expected.type_code
      and position(expected.token in concat_ws(' ', r.record_code, r.title, r.summary, r.metadata::text)) > 0
  );
  if v_missing <> 0 then raise exception 'CP6 sensitive searchable precondition failed: % records missing tokens', v_missing; end if;
end $$;

-- The outer Function Scan is diagnostic only; it is not index evidence for
-- RPC internals. The next plan mirrors the RPC searchable expression and the
-- final selective plan verifies actual use of the maintained GIN index.
\echo CP6_EXPLAIN_RPC_FUNCTION_BEGIN
explain (analyze, buffers, format json)
select * from public.api_search_database_records(
  (select actor_id from cp6_benchmark_config),
  'needle-filter', null, null, null, 50, 0
);
\echo CP6_EXPLAIN_RPC_FUNCTION_END

\echo CP6_EXPLAIN_RPC_INTERNAL_BEGIN
explain (analyze, buffers, format json)
select r.id
from public.db_records as r
where to_tsvector('simple', concat_ws(' ', r.record_code, r.title, r.summary, coalesce((
  select string_agg(e.value, ' ')
  from jsonb_each_text(r.metadata) as e
  where exists (
    select 1 from public.db_form_fields as f
    where f.form_definition_id = r.form_definition_id
      and f.field_key = e.key
      and f.searchable = true
  )
), '')))
      @@ websearch_to_tsquery('simple', 'needle-filter');
\echo CP6_EXPLAIN_RPC_INTERNAL_END

\echo CP6_EXPLAIN_SEARCH_INDEX_BEGIN
explain (analyze, buffers, format json)
select r.id
from public.db_records as r
where r.search_document @@ websearch_to_tsquery('simple', 'cp6-index-probe-unique');
\echo CP6_EXPLAIN_SEARCH_INDEX_END

create temporary table cp6_latency (scenario text not null, elapsed_ms double precision not null) on commit drop;

do $$
declare
  started timestamptz;
  i integer;
  ignored bigint;
begin
  -- Warm the planner, catalog and buffer cache without including these calls.
  for i in 1..5 loop
    select count(*) into ignored from public.api_search_database_records((select actor_id from cp6_benchmark_config), null, null, null, null, 50, 0);
    select count(*) into ignored from public.api_search_database_records((select actor_id from cp6_benchmark_config), 'needle-filter', 'approved', null, null, 50, 0);
  end loop;
  for i in 1..35 loop
    started := clock_timestamp();
    select count(*) into ignored from public.api_search_database_records((select actor_id from cp6_benchmark_config), null, null, null, null, 50, 0);
    insert into cp6_latency values ('search', extract(epoch from clock_timestamp() - started) * 1000);
    started := clock_timestamp();
    select count(*) into ignored from public.api_search_database_records((select actor_id from cp6_benchmark_config), 'needle-filter', 'approved', null, null, 50, 0);
    insert into cp6_latency values ('filtered_search', extract(epoch from clock_timestamp() - started) * 1000);
    started := clock_timestamp();
    perform count(*) from public.db_records r
      left join public.db_record_acl a on a.record_id = r.id
      left join public.db_record_files f on f.record_id = r.id
      where r.id = (select detail_record_id from cp6_benchmark_config);
    insert into cp6_latency values ('detail_sql', extract(epoch from clock_timestamp() - started) * 1000);
  end loop;
end $$;

do $$
declare
  v_scenario record;
begin
  for v_scenario in
    select scenario, count(*) as samples,
           percentile_cont(0.95) within group (order by elapsed_ms) as p95_ms
    from cp6_latency group by scenario
  loop
    if v_scenario.samples <> 35 then
      raise exception 'CP6 benchmark incomplete: % has % samples, expected 35', v_scenario.scenario, v_scenario.samples;
    elsif v_scenario.scenario = 'search' and v_scenario.p95_ms > 250 then
      raise exception 'CP6 search p95 threshold exceeded: % ms', round(v_scenario.p95_ms::numeric, 3);
    elsif v_scenario.scenario = 'filtered_search' and v_scenario.p95_ms > 400 then
      raise exception 'CP6 filtered search p95 threshold exceeded: % ms', round(v_scenario.p95_ms::numeric, 3);
    elsif v_scenario.scenario = 'detail_sql' and v_scenario.p95_ms > 200 then
      raise exception 'CP6 SQL detail p95 threshold exceeded: % ms', round(v_scenario.p95_ms::numeric, 3);
    end if;
  end loop;
  if (select count(distinct scenario) from cp6_latency) <> 3 then
    raise exception 'CP6 benchmark incomplete: expected all SQL scenarios';
  end if;
end $$;

select scenario,
       count(*) as samples,
       round((percentile_cont(0.50) within group (order by elapsed_ms))::numeric, 3) as p50_ms,
       round((percentile_cont(0.95) within group (order by elapsed_ms))::numeric, 3) as p95_ms,
       round(avg(elapsed_ms)::numeric, 3) as avg_ms
from cp6_latency
group by scenario
order by scenario;

do $$
declare
  v_page_one integer;
  v_page_two integer;
  v_total bigint;
  v_overlap integer;
  v_union integer;
  v_expected integer;
  v_filtered_rows integer;
  v_filtered_total bigint;
  v_expected_filtered integer;
begin
  select count(*), coalesce(max(sr.total_count), 0) into v_page_one, v_total
  from public.api_search_database_records((select actor_id from cp6_benchmark_config), null, null, null, null, 50, 0) as sr;
  select count(*) into v_page_two
  from public.api_search_database_records((select actor_id from cp6_benchmark_config), null, null, null, null, 50, 50);
  select count(*) into v_overlap from (
    select id from public.api_search_database_records((select actor_id from cp6_benchmark_config), null, null, null, null, 50, 0)
    intersect
    select id from public.api_search_database_records((select actor_id from cp6_benchmark_config), null, null, null, null, 50, 50)
  ) as overlap_rows;
  select count(*) into v_union from (
    select id from public.api_search_database_records((select actor_id from cp6_benchmark_config), null, null, null, null, 50, 0)
    union
    select id from public.api_search_database_records((select actor_id from cp6_benchmark_config), null, null, null, null, 50, 50)
  ) as page_rows;
  select records_seeded into v_expected from cp6_benchmark_config;
  select count(*), coalesce(max(sr.total_count), 0) into v_filtered_rows, v_filtered_total
  from public.api_search_database_records((select actor_id from cp6_benchmark_config), 'needle-filter', 'approved', null, null, 100, 0) as sr;
  select filtered_expected into v_expected_filtered from cp6_benchmark_config;
  if v_page_one <> 50 or v_page_two <> 50 or v_overlap <> 0 or v_union <> 100 or v_total <> v_expected then
    raise exception 'CP6 pagination/ACL assertion failed: page1 %, page2 %, overlap %, union %, total %, expected %', v_page_one, v_page_two, v_overlap, v_union, v_total, v_expected;
  end if;
  if v_filtered_rows <= 0 or v_filtered_total <> v_expected_filtered then
    raise exception 'CP6 filtered search count failed: rows %, total %, expected %', v_filtered_rows, v_filtered_total, v_expected_filtered;
  end if;
  if exists (
    select 1 from public.api_search_database_records((select actor_id from cp6_benchmark_config), null, null, null, null, 100, 0) as sr
    where sr.record_code like 'CP6-BENCH-SENSITIVE-%'
  ) then
    raise exception 'CP6 pagination leaked a sensitive record';
  end if;
end $$;

do $$
declare
  v_denied_rows integer;
  v_denied_total bigint;
  v_allowed_rows integer;
  v_allowed_total bigint;
begin
  select count(*), coalesce(max(sr.total_count), 0) into v_denied_rows, v_denied_total
  from public.api_search_database_records((select actor_id from cp6_benchmark_config), 'cp6-sensitive', null, null, null, 100, 0) as sr;
  if v_denied_rows <> 0 or v_denied_total <> 0 then
    raise exception 'CP6 sensitive deny failed: rows %, total %', v_denied_rows, v_denied_total;
  end if;
  select count(distinct sr.id), coalesce(max(sr.total_count), 0) into v_allowed_rows, v_allowed_total
  from public.api_search_database_records((select admin_id from cp6_benchmark_config), 'cp6-sensitive', null, null, null, 100, 0) as sr;
  if v_allowed_rows <> 4 or v_allowed_total <> 4 then
    raise exception 'CP6 sensitive positive control failed: rows %, total %', v_allowed_rows, v_allowed_total;
  end if;
end $$;

select pg_size_pretty(pg_database_size(current_database())) as database_size,
       pg_database_size(current_database()) as database_size_bytes,
       'SQL RPC/search/detail metrics complete; HTTP detail follows separately' as sql_evidence;

commit;

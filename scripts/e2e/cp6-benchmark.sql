\set ON_ERROR_STOP on

-- CP6 Phase 2 synthetic benchmark fixture. Run only against the disposable
-- database created by start-sandbox.sh; all identifiers are deterministic.
begin;

create temporary table cp6_benchmark_config (
  actor_id uuid not null,
  detail_record_id uuid not null,
  records_seeded integer not null,
  sensitive_seeded integer not null
) on commit drop;

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
  'CP6 benchmark record ' || n,
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
  'CP6 benchmark sensitive ' || s.code,
  'sensitive benchmark record',
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

insert into cp6_benchmark_config(actor_id, detail_record_id, records_seeded, sensitive_seeded)
select
  (select id from public.staff_users where username = 'e2e-employee'),
  '71000000-0000-4000-8000-000000000001'::uuid,
  (select count(*) from public.db_records where record_code like 'CP6-BENCH-%' and record_code not like 'CP6-BENCH-SENSITIVE-%'),
  (select count(*) from public.db_records where record_code like 'CP6-BENCH-SENSITIVE-%');

do $$
declare
  v_records integer;
  v_sensitive integer;
  v_acl integer;
  v_files integer;
begin
  select records_seeded, sensitive_seeded into v_records, v_sensitive from cp6_benchmark_config;
  select count(*) into v_acl from public.db_record_acl where record_id = '71000000-0000-4000-8000-000000000001'::uuid;
  select count(*) into v_files from public.db_record_files where record_id = '71000000-0000-4000-8000-000000000001'::uuid;
  if v_records <> 10000 then raise exception 'CP6 benchmark expected 10000 normal records, got %', v_records; end if;
  if v_sensitive <> 4 then raise exception 'CP6 benchmark expected 4 sensitive records, got %', v_sensitive; end if;
  if v_acl <> 20 then raise exception 'CP6 benchmark expected 20 ACL rows, got %', v_acl; end if;
  if v_files <> 10 then raise exception 'CP6 benchmark expected 10 file rows, got %', v_files; end if;
end $$;

-- Plan evidence: the RPC computes searchable_text after ACL filtering. The
-- result is retained by the workflow as a bounded diagnostic artifact.
explain (analyze, buffers, format json)
select * from public.api_search_database_records(
  (select actor_id from cp6_benchmark_config),
  'needle-filter', null, null, null, 50, 0
);

create temporary table cp6_latency (scenario text not null, elapsed_ms double precision not null) on commit drop;

do $$
declare
  started timestamptz;
  i integer;
  ignored integer;
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
    insert into cp6_latency values ('detail', extract(epoch from clock_timestamp() - started) * 1000);
  end loop;
end $$;

select scenario,
       count(*) as samples,
       round((percentile_cont(0.50) within group (order by elapsed_ms))::numeric, 3) as p50_ms,
       round((percentile_cont(0.95) within group (order by elapsed_ms))::numeric, 3) as p95_ms,
       round(avg(elapsed_ms)::numeric, 3) as avg_ms
from cp6_latency
group by scenario
order by scenario;

select 'pagination_acl_consistency' as check_name,
       case when count(*) = 0 then 'PASS' else 'FAIL' end as result
from (
  select id from public.api_search_database_records((select actor_id from cp6_benchmark_config), null, null, null, null, 50, 0)
  intersect
  select id from public.api_search_database_records((select actor_id from cp6_benchmark_config), null, null, null, null, 50, 50)
) overlap_rows;

select 'sensitive_records_excluded' as check_name,
       case when count(*) = 0 then 'PASS' else 'FAIL' end as result
from public.api_search_database_records((select actor_id from cp6_benchmark_config), 'cp6-sensitive', null, null, null, 100, 0)
where record_code like 'CP6-BENCH-SENSITIVE-%';

select 'sensitive_metadata_and_count_hidden' as check_name,
       case when count(*) = 0 and coalesce(max(total_count), 0) = 0 then 'PASS' else 'FAIL' end as result
from public.api_search_database_records((select actor_id from cp6_benchmark_config), 'cp6-sensitive', null, null, null, 100, 0);

select pg_size_pretty(pg_database_size(current_database())) as database_size,
       pg_database_size(current_database()) as database_size_bytes,
       1 as detail_query_count,
       'single set-based SQL statement; no application N+1 loop' as detail_query_model;

rollback;

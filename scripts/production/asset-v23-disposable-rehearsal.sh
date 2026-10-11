#!/usr/bin/env bash
set -Eeuo pipefail

root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd -P)
container="asset-v23-rehearsal-$$"
port=$((56500 + ($$ % 100)))
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$container" -p "127.0.0.1:${port}:5432" -e POSTGRES_PASSWORD=test -e POSTGRES_DB=runner postgres:17 >/dev/null
db="postgresql://postgres@127.0.0.1:${port}/runner"
export PGPASSWORD=test
for _ in $(seq 1 60); do psql "$db" -Atqc 'select 1' >/dev/null 2>&1 && break; sleep 1; done

psql "$db" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
create role anon; create role authenticated; create role service_role;
create schema auth; create table auth.users(id uuid primary key);
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
create extension if not exists pgcrypto;
SQL

files=(
  20260318101500_baseline.sql
  20260320114500_hr_assets_documents_performance_mvp.sql
  20260819123000_role_lifecycle_and_tbt_direct.sql
  20260916100000_phase1a_rbac_core.sql
  20261001090000_quick_report_task_v1.sql
  20261001110000_user_specific_permission_grants.sql
  20261009100000_asset_management_v2.sql
  20261010100000_asset_management_v21_quantity_import.sql
  20261011100000_asset_management_v211_unassigned_import.sql
  20261012100000_asset_management_v22_status_requests.sql
)
for file in "${files[@]}"; do psql "$db" -v ON_ERROR_STOP=1 -f "$root/supabase/migrations/$file" >/dev/null; done

psql "$db" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
insert into public.departments(id,code,name,active) values ('00000000-0000-0000-0000-000000000001','D1','Dept',true);
insert into public.roles(id,code,name,level,active) values
 ('00000000-0000-0000-0000-000000000010','admin','Admin',10,true),
 ('00000000-0000-0000-0000-000000000011','nhan_vien','Staff',1,true);
insert into public.staff_users(id,full_name,password,role_id,department_id,active) values
 ('00000000-0000-0000-0000-000000000020','Manager','x','00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001',true),
 ('00000000-0000-0000-0000-000000000021','Requester','x','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001',true);
insert into public.role_permission_grants(role_id,permission_id,scope)
select '00000000-0000-0000-0000-000000000010', id, 'all' from public.permissions where code='asset.manage';
insert into public.assets(id,asset_code,asset_name,category,status) values
 ('10000000-0000-0000-0000-000000000001','A','A','C','in_use'),
 ('10000000-0000-0000-0000-000000000002','B','B','C','available'),
 ('10000000-0000-0000-0000-000000000003','C','C','C','maintenance'),
 ('10000000-0000-0000-0000-000000000004','D','D','C','maintenance'),
 ('10000000-0000-0000-0000-000000000005','E','E','C','broken'),
 ('10000000-0000-0000-0000-000000000006','F','F','C','broken'),
 ('10000000-0000-0000-0000-000000000007','G','G','C','liquidated');
insert into public.asset_assignments(id,asset_id,assignee_id,department_id,status,created_by) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000001','active','00000000-0000-0000-0000-000000000020'),
 ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000001','active','00000000-0000-0000-0000-000000000020'),
 ('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000001','active','00000000-0000-0000-0000-000000000020');
SQL

psql "$db" -v ON_ERROR_STOP=1 -f "$root/supabase/migrations/20261013100000_asset_management_v23_condition_service.sql" >/dev/null

psql "$db" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
do $$
declare r jsonb; request_id uuid; record_id uuid; old_assignment_count int;
begin
  select count(*) into old_assignment_count from public.asset_assignments;
  if not exists(select 1 from assets where asset_code='A' and status='in_use' and condition_status='normal') then raise exception 'A failed'; end if;
  if not exists(select 1 from assets where asset_code='B' and status='available' and condition_status='normal') then raise exception 'B failed'; end if;
  if not exists(select 1 from assets where asset_code='C' and status='in_use' and condition_status='needs_maintenance') then raise exception 'C failed'; end if;
  if not exists(select 1 from assets where asset_code='D' and status='available' and condition_status='needs_maintenance') then raise exception 'D failed'; end if;
  if not exists(select 1 from assets where asset_code='E' and status='in_use' and condition_status='broken') then raise exception 'E failed'; end if;
  if not exists(select 1 from assets where asset_code='F' and status='available' and condition_status='broken') then raise exception 'F failed'; end if;
  if not exists(select 1 from assets where asset_code='G' and status='liquidated' and condition_status='normal') then raise exception 'G failed'; end if;

  r := public.api_asset_status_request_create('00000000-0000-0000-0000-000000000021','10000000-0000-0000-0000-000000000001','maintenance','needs service');
  request_id := (r->>'id')::uuid;
  perform public.api_asset_status_request_review('00000000-0000-0000-0000-000000000020',request_id,'approve',null);
  if not exists(select 1 from assets where asset_code='A' and status='in_use' and condition_status='needs_maintenance') then raise exception 'approval failed'; end if;
  if (select count(*) from audit_logs where entity_id=request_id and action='condition_change_approved') <> 1 then raise exception 'approval audit failed'; end if;
  begin perform public.api_asset_status_request_create('00000000-0000-0000-0000-000000000021','10000000-0000-0000-0000-000000000001','maintenance','noop'); raise exception 'noop accepted'; exception when sqlstate '22023' then null; end;

  r := public.api_asset_service_record_create('00000000-0000-0000-0000-000000000020','10000000-0000-0000-0000-000000000003','maintenance','planned','planned service',null,null,null,null,null,null);
  record_id := (r->'record'->>'id')::uuid;
  if (select condition_status from assets where asset_code='C') <> 'needs_maintenance' then raise exception 'planned create mutated condition'; end if;
  if (select count(*) from audit_logs where entity_id=record_id and action='service_record_create') <> 1 then raise exception 'create audit failed'; end if;
  perform public.api_asset_service_record_update('00000000-0000-0000-0000-000000000020',record_id,'10000000-0000-0000-0000-000000000003','maintenance','completed','completed service',null,null,null,null,'normal','done');
  if (select condition_status from assets where asset_code='C') <> 'normal' then raise exception 'completion failed'; end if;
  update assets set condition_status='broken' where asset_code='C';
  perform public.api_asset_service_record_update('00000000-0000-0000-0000-000000000020',record_id,'10000000-0000-0000-0000-000000000003','maintenance','completed','edited description',null,null,null,null,'normal','edited');
  if (select condition_status from assets where asset_code='C') <> 'broken' then raise exception 'completed edit reapplied condition'; end if;
  if exists(select 1 from audit_logs where entity_id=record_id and action='service_record_update' and (old_data is null or new_data is null)) then raise exception 'update audit missing old/new'; end if;
  begin perform public.api_asset_service_record_update('00000000-0000-0000-0000-000000000020',record_id,'10000000-0000-0000-0000-000000000002','maintenance','completed','wrong asset',null,null,null,null,'normal',null); raise exception 'wrong asset accepted'; exception when no_data_found then null; when sqlstate 'P0002' then null; end;
  begin perform public.api_asset_service_record_create('00000000-0000-0000-0000-000000000020','10000000-0000-0000-0000-000000000002','bad','planned','invalid',null,null,null,null,null,null); raise exception 'invalid type accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.api_asset_service_record_create('00000000-0000-0000-0000-000000000020','10000000-0000-0000-0000-000000000002','maintenance','planned','negative cost',null,-1,null,null,null,null); raise exception 'negative accepted'; exception when sqlstate '22023' then null; end;
  if (select count(*) from public.asset_assignments) <> old_assignment_count then raise exception 'assignments changed'; end if;
end $$;
SQL

test "$(psql "$db" -Atqc "select relrowsecurity from pg_class where oid='public.asset_service_records'::regclass")" = t
test "$(psql "$db" -Atqc "select count(*) from information_schema.routine_privileges where specific_schema='public' and routine_name='api_asset_service_record_create' and grantee='service_role'")" -ge 1

createdb -h 127.0.0.1 -p "$port" -U postgres atomicity
atomic="postgresql://postgres@127.0.0.1:${port}/atomicity"
psql "$atomic" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
create schema auth; create table auth.users(id uuid primary key);
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
create extension if not exists pgcrypto;
SQL
for file in "${files[@]}"; do psql "$atomic" -v ON_ERROR_STOP=1 -f "$root/supabase/migrations/$file" >/dev/null; done
sed '$i select * from public.__intentional_failure;' "$root/supabase/migrations/20261013100000_asset_management_v23_condition_service.sql" | psql "$atomic" -v ON_ERROR_STOP=1 >/dev/null 2>&1 && exit 1 || true
test "$(psql "$atomic" -Atqc "select count(*) from information_schema.columns where table_schema='public' and table_name='assets' and column_name='condition_status'")" = 0

echo 'asset-v23 disposable rehearsal: PASS'

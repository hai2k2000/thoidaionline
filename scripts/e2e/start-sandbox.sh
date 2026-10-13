#!/usr/bin/env bash
set -Eeuo pipefail

# This fixture is intentionally localhost-only. It creates all test state inside
# one disposable Docker network and never reads production configuration.
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd -P)
run_id=${GITHUB_RUN_ID:-local}-$$
network="thoidai-e2e-${run_id}"
postgres="thoidai-e2e-postgres-${run_id}"
postgrest="thoidai-e2e-postgrest-${run_id}"
pg_port=$((18000 + ($$ % 700)))
api_port=$((19000 + ($$ % 700)))
env_file=${E2E_ENV_FILE:-${RUNNER_TEMP:-/tmp}/thoidai-e2e.env}

cleanup() {
  docker rm -f "$postgrest" "$postgres" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup INT TERM
on_exit() {
  status=$?
  if [[ "$status" -ne 0 ]]; then cleanup; fi
  exit "$status"
}
trap on_exit EXIT

command -v docker >/dev/null || { echo "Docker is required for isolated E2E" >&2; exit 1; }
command -v curl >/dev/null || { echo "curl is required for isolated E2E" >&2; exit 1; }

docker network create "$network" >/dev/null
docker run -d --name "$postgres" --network "$network" \
  -p "127.0.0.1:${pg_port}:5432" \
  -e POSTGRES_PASSWORD=e2e-postgres-only \
  -e POSTGRES_DB=thoidai_e2e postgres:17.2 >/dev/null

db_url="postgresql://postgres:e2e-postgres-only@127.0.0.1:${pg_port}/thoidai_e2e"
for _ in $(seq 1 90); do
  if docker exec "$postgres" pg_isready -U postgres -d thoidai_e2e >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$postgres" pg_isready -U postgres -d thoidai_e2e >/dev/null

docker exec -i "$postgres" psql -v ON_ERROR_STOP=1 -U postgres -d thoidai_e2e <<'SQL'
create extension if not exists pgcrypto;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login password 'e2e-authenticator-only' noinherit;
grant anon, authenticated, service_role to authenticator;
create schema auth;
create table auth.users(id uuid primary key);
create schema storage;
create table storage.buckets(
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects(
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text
);
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations(
  version text primary key,
  name text not null,
  applied_at timestamptz not null default now()
);
grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant all on all tables in schema public, auth, storage to service_role;
grant all on all sequences in schema public, auth, storage to service_role;
SQL

files=(
  20260318101500_baseline.sql
  20260318132500_add_username_to_staff_users.sql
  20260320114500_hr_assets_documents_performance_mvp.sql
  20260813110000_task_evaluation_checkpoints.sql
  20260813172000_task_plans_recipients_self_claim.sql
  20260813210000_password_reset_security.sql
  20260814070000_job_titles.sql
  20260814160000_employee_password_reset_admin.sql
  20260814190000_phase1_authorization_facade.sql
  20260817050000_phase3_additive_task_schema.sql
  20260819123000_role_lifecycle_and_tbt_direct.sql
  20260820090000_task_assignment_reviewer_daily_due_time.sql
  20260822200000_account_personalization.sql
  20260916100000_phase1a_rbac_core.sql
  20260916103000_phase1a_rbac_db_helper.sql
  20260916104500_phase1a_rbac_compatibility_completion.sql
  20260924120000_task_approval_gates.sql
  20260924130000_task_assignment_semantics.sql
  20261001090000_quick_report_task_v1.sql
  20261001100000_admin_quick_report_permission_management.sql
  20261001110000_user_specific_permission_grants.sql
  20261002150000_quick_report_ux_v2.sql
  20261009100000_asset_management_v2.sql
  20261010100000_asset_management_v21_quantity_import.sql
  20261011100000_asset_management_v211_unassigned_import.sql
  20261012100000_asset_management_v22_status_requests.sql
  20261013100000_asset_management_v23_condition_service.sql
  20261014100000_asset_manage_permission_management.sql
  20261015100000_rbac_v2_role_user_overrides.sql
  20261015110000_rbac_v2_scope_ambiguity_fix.sql
  20261015120000_quick_report_rpc_payload_compatibility.sql
)

# The first RBAC migration expects the admin role to exist. Seed the role and
# its legacy capability row immediately after the baseline migration.
for file in "${files[@]}"; do
  docker cp "$root/supabase/migrations/$file" "$postgres:/tmp/$file"
  docker exec "$postgres" psql -v ON_ERROR_STOP=1 -U postgres -d thoidai_e2e -f "/tmp/$file" >/dev/null
  version=${file%%_*}
  docker exec "$postgres" psql -v ON_ERROR_STOP=1 -U postgres -d thoidai_e2e -c "insert into supabase_migrations.schema_migrations(version,name) values ('$version','$file') on conflict (version) do nothing" >/dev/null
  if [[ "$file" == "20260318101500_baseline.sql" ]]; then
    docker exec -i "$postgres" psql -v ON_ERROR_STOP=1 -U postgres -d thoidai_e2e <<'SQL' >/dev/null
insert into public.departments(id,code,name,active) values
  ('10000000-0000-0000-0000-000000000001','e2e','E2E Department',true),
  ('10000000-0000-0000-0000-000000000002','e2e-other','E2E Other',true)
on conflict (id) do nothing;
insert into public.roles(id,code,name,level) values
  ('20000000-0000-0000-0000-000000000001','admin','E2E Admin',10),
  ('20000000-0000-0000-0000-000000000002','nhan_vien','E2E Employee',1)
on conflict (id) do nothing;
insert into public.role_permissions(role_id,can_manage_users,can_manage_permissions,can_create_task,can_edit_all_tasks,can_comment)
values ('20000000-0000-0000-0000-000000000001',true,true,true,true,true),
       ('20000000-0000-0000-0000-000000000002',false,false,true,false,true)
on conflict (role_id) do update set can_manage_users=excluded.can_manage_users, can_manage_permissions=excluded.can_manage_permissions;
SQL
  fi
done

test "$(docker exec "$postgres" psql -At -U postgres -d thoidai_e2e -c "select count(*) from supabase_migrations.schema_migrations")" = "${#files[@]}"
test "$(docker exec "$postgres" psql -At -U postgres -d thoidai_e2e -c "select count(*) from supabase_migrations.schema_migrations where version='20261015100000'")" = 1
test "$(docker exec "$postgres" psql -At -U postgres -d thoidai_e2e -c "select count(*) from supabase_migrations.schema_migrations where version='20261015110000'")" = 1
test "$(docker exec "$postgres" psql -At -U postgres -d thoidai_e2e -c "select count(*) from supabase_migrations.schema_migrations where version='20261015120000'")" = 1
test "$(docker exec "$postgres" psql -At -U postgres -d thoidai_e2e -c "select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='api_list_effective_permissions'")" = 1
test "$(docker exec "$postgres" psql -At -U postgres -d thoidai_e2e -c "select has_function_privilege('service_role','public.api_list_effective_permissions(uuid)','execute')")" = t

# Keep the fixture independent from the optional production password-reset
# migration's `extensions` schema; the application only needs this additive flag.
docker exec "$postgres" psql -v ON_ERROR_STOP=1 -U postgres -d thoidai_e2e -c \
  'alter table public.staff_users add column if not exists must_change_password boolean not null default false' >/dev/null

test_password=$(node -e "console.log(require('node:crypto').randomBytes(24).toString('base64url'))")
password_hash=$(E2E_PASSWORD="$test_password" node --input-type=module -e "import bcrypt from 'bcryptjs'; console.log(await bcrypt.hash(process.env.E2E_PASSWORD, 10));")
docker exec -i "$postgres" psql -v ON_ERROR_STOP=1 -U postgres -d thoidai_e2e <<SQL >/dev/null
insert into public.staff_users(id,full_name,username,email,password_hash,password,role_id,department_id,active,session_version,must_change_password,preferences)
values
 ('30000000-0000-0000-0000-000000000001','E2E Admin','e2e-admin','e2e-admin@test.invalid','$password_hash',null,'20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',true,0,false,'{}'),
 ('30000000-0000-0000-0000-000000000002','E2E Employee','e2e-employee','e2e-employee@test.invalid','$password_hash',null,'20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',true,0,false,'{}')
on conflict (id) do update set password_hash=excluded.password_hash,password=null,active=true,must_change_password=false;
insert into public.permissions(code,name,module,description) values
 ('asset.view','View assets','assets','E2E asset view'),
 ('asset.manage','Manage assets','assets','E2E asset manage')
on conflict (code) do nothing;
insert into public.role_permission_grants(role_id,permission_id,scope)
select '20000000-0000-0000-0000-000000000001', id, 'all' from public.permissions where code in ('asset.view','asset.manage','task.quick_report.create','permission.manage')
on conflict (role_id,permission_id,scope) do nothing;
insert into public.role_permission_grants(role_id,permission_id,scope)
select '20000000-0000-0000-0000-000000000002', id, 'assigned' from public.permissions where code='asset.view'
on conflict (role_id,permission_id,scope) do nothing;
insert into public.assets(id,asset_code,asset_name,category,status,condition_status)
values ('40000000-0000-0000-0000-000000000001','E2E-001','E2E assigned asset','e2e','in_use','normal'),
       ('40000000-0000-0000-0000-000000000002','E2E-002','E2E hidden asset','e2e','available','normal')
on conflict (id) do update set status=excluded.status,condition_status=excluded.condition_status;
insert into public.asset_assignments(id,asset_id,assignee_id,department_id,status,created_by)
values ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','active','30000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;
SQL

docker exec -i "$postgres" psql -v ON_ERROR_STOP=1 -U postgres -d thoidai_e2e <<'SQL' >/dev/null
grant select on all tables in schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select, update on all sequences in schema public to service_role;
grant select, insert, update, delete on all tables in schema storage to service_role;
grant execute on all functions in schema public to service_role;
SQL

jwt_secret=$(node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))")
make_jwt() {
  E2E_JWT_SECRET="$jwt_secret" E2E_ROLE="$1" node --input-type=module -e '
import crypto from "node:crypto";
const b = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
const h = b({alg:"HS256",typ:"JWT"});
const p = b({role:process.env.E2E_ROLE,iss:"thoidai-e2e",aud:"authenticated",iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600});
const body = `${h}.${p}`;
console.log(`${body}.${crypto.createHmac("sha256", process.env.E2E_JWT_SECRET).update(body).digest("base64url")}`);
'
}
anon_key=$(make_jwt anon)
service_key=$(make_jwt service_role)
echo "::add-mask::$jwt_secret"
echo "::add-mask::$anon_key"
echo "::add-mask::$service_key"
session_secret=$(node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))")
echo "::add-mask::$session_secret"
echo "::add-mask::$test_password"

docker run -d --name "$postgrest" --network "$network" -p "127.0.0.1:${api_port}:3000" \
  -e PGRST_DB_URI="postgres://authenticator:e2e-authenticator-only@${postgres}:5432/thoidai_e2e" \
  -e PGRST_DB_SCHEMA=public -e PGRST_DB_ANON_ROLE=anon \
  -e PGRST_JWT_SECRET="$jwt_secret" -e PGRST_SERVER_PORT=3000 \
  postgrest/postgrest:v14.7 >/dev/null
for _ in $(seq 1 60); do curl -fsS "http://127.0.0.1:${api_port}/" >/dev/null 2>&1 && break; sleep 1; done
curl -fsS "http://127.0.0.1:${api_port}/" >/dev/null

mkdir -p "$(dirname "$env_file")"
umask 077
cat >"$env_file" <<EOF
E2E_POSTGREST_URL=http://127.0.0.1:${api_port}
E2E_ANON_KEY=${anon_key}
E2E_SERVICE_ROLE_KEY=${service_key}
E2E_SESSION_SECRET=${session_secret}
E2E_ADMIN_USERNAME=e2e-admin
E2E_EMPLOYEE_USERNAME=e2e-employee
E2E_PASSWORD=${test_password}
E2E_NETWORK=${network}
E2E_POSTGRES_CONTAINER=${postgres}
E2E_POSTGREST_CONTAINER=${postgrest}
EOF
echo "E2E sandbox ready: postgrest=http://127.0.0.1:${api_port} postgres_port=${pg_port}"

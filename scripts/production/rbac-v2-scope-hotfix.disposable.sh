#!/usr/bin/env bash
set -Eeuo pipefail

root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd -P)
id=${GITHUB_RUN_ID:-local}-$$
network="rbac-scope-net-$id"
postgres="rbac-scope-pg-$id"
postgrest="rbac-scope-api-$id"
pg_port=$((18000 + ($$ % 500)))
api_port=$((19000 + ($$ % 500)))
db="postgresql://postgres:disposable-only@127.0.0.1:$pg_port/rbac_scope"
jwt_secret=$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")

cleanup() {
  docker rm -f "$postgrest" "$postgres" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT
for tool in docker psql curl node; do command -v "$tool" >/dev/null || { echo "$tool is required" >&2; exit 1; }; done

docker network create "$network" >/dev/null
docker run -d --name "$postgres" --network "$network" -p "127.0.0.1:$pg_port:5432" \
  -e POSTGRES_PASSWORD=disposable-only -e POSTGRES_DB=rbac_scope postgres:17 >/dev/null
export PGPASSWORD=disposable-only
for _ in $(seq 1 90); do psql "$db" -Atqc 'select 1' >/dev/null 2>&1 && break; sleep 1; done
psql "$db" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
create extension if not exists pgcrypto;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login password 'disposable-authenticator-only' noinherit;
grant anon, authenticated, service_role to authenticator;
create schema auth;
create table auth.users(id uuid primary key);
create schema storage;
create table storage.buckets(id text primary key, name text not null, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
create schema supabase_migrations;
create table supabase_migrations.schema_migrations(version text primary key, name text not null, statements text[] not null default '{}', applied_at timestamptz not null default now());
grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant all on all tables in schema public, auth, storage to service_role;
grant all on all sequences in schema public, auth, storage to service_role;
SQL

files=(
  20260318101500_baseline.sql
  20260318132500_add_username_to_staff_users.sql
  20260320114500_hr_assets_documents_performance_mvp.sql
  20260813110000_task_evaluation_checkpoints.sql
  20260813210000_password_reset_security.sql
  20260814070000_job_titles.sql
  20260814160000_employee_password_reset_admin.sql
  20260814190000_phase1_authorization_facade.sql
  20260819123000_role_lifecycle_and_tbt_direct.sql
  20260822200000_account_personalization.sql
  20260916100000_phase1a_rbac_core.sql
  20260916103000_phase1a_rbac_db_helper.sql
  20260916104500_phase1a_rbac_compatibility_completion.sql
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
)
for file in "${files[@]}"; do
  psql "$db" -v ON_ERROR_STOP=1 -f "$root/supabase/migrations/$file" >/dev/null
  version=${file%%_*}
  psql "$db" -v ON_ERROR_STOP=1 -c "insert into supabase_migrations.schema_migrations(version,name) values ('$version','$file') on conflict (version) do nothing" >/dev/null
  if [[ "$file" == 20260318101500_baseline.sql ]]; then
    psql "$db" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
insert into public.departments(id,code,name,active) values ('10000000-0000-0000-0000-000000000001','e2e','E2E',true);
insert into public.roles(id,code,name,level) values ('20000000-0000-0000-0000-000000000001','admin','Admin',10);
insert into public.role_permissions(role_id,can_manage_users,can_manage_permissions,can_create_task,can_edit_all_tasks,can_comment) values ('20000000-0000-0000-0000-000000000001',true,true,true,true,true);
SQL
  fi
done

psql "$db" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
alter table public.staff_users add column if not exists must_change_password boolean not null default false;
insert into public.staff_users(id,full_name,username,email,password_hash,password,role_id,department_id,active,session_version,must_change_password,preferences)
values ('30000000-0000-0000-0000-000000000001','E2E Admin','e2e-admin','e2e-admin@test.invalid',null,null,'20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',true,0,false,'{}');
insert into public.permissions(code,name,module,description) values ('scope.regression','Scope regression','e2e','scope regression') on conflict (code) do nothing;
insert into public.role_permission_grants(role_id,permission_id,scope)
select '20000000-0000-0000-0000-000000000001',id,'all' from public.permissions where code='scope.regression' on conflict do nothing;
grant select on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;
SQL

docker run -d --name "$postgrest" --network "$network" -p "127.0.0.1:$api_port:3000" \
  -e PGRST_DB_URI="postgres://authenticator:disposable-authenticator-only@$postgres:5432/rbac_scope" \
  -e PGRST_DB_SCHEMA=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$jwt_secret" -e PGRST_SERVER_PORT=3000 \
  postgrest/postgrest:v14.7 >/dev/null
for _ in $(seq 1 60); do curl -fsS "http://127.0.0.1:$api_port/" >/dev/null 2>&1 && break; sleep 1; done
service_key=$(E2E_JWT_SECRET="$jwt_secret" node --input-type=module -e '
import crypto from "node:crypto";
const b = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
const h=b({alg:"HS256",typ:"JWT"}); const p=b({role:"service_role",iss:"rbac-scope-e2e",exp:Math.floor(Date.now()/1000)+3600}); const body=`${h}.${p}`;
console.log(`${body}.${crypto.createHmac("sha256",process.env.E2E_JWT_SECRET).update(body).digest("base64url")}`);
')
headers=(-H "Content-Type: application/json" -H "Accept-Profile: public" -H "apikey: $service_key" -H "Authorization: Bearer $service_key")

before=$(curl -sS -o /tmp/rbac-scope-before.json -w '%{http_code}' -X POST "${headers[@]}" --data '{"p_actor_id":"30000000-0000-0000-0000-000000000001"}' "http://127.0.0.1:$api_port/rpc/api_list_role_permission_grants")
grep -q '42702' /tmp/rbac-scope-before.json || { echo "expected pre-hotfix SQLSTATE 42702, got HTTP $before" >&2; cat /tmp/rbac-scope-before.json >&2; exit 1; }
state_before=$(psql "$db" -Atqc "select (select count(*) from roles),(select count(*) from staff_users),(select count(*) from role_permission_grants),(select count(*) from user_permission_grants)")

tmp=$(mktemp -d)
mkdir -p "$tmp/supabase/migrations" "$tmp/evidence"
cp "$root/supabase/migrations/20261015110000_rbac_v2_scope_ambiguity_fix.sql" "$tmp/supabase/migrations/"
export SAFE_MIGRATION_MIGRATIONS_DIR="$tmp/supabase/migrations" HOTFIX_DB_URL="$db"
bash "$root/scripts/production/safe-apply-migration.sh" --file "$tmp/supabase/migrations/20261015110000_rbac_v2_scope_ambiguity_fix.sql" --db-url-env HOTFIX_DB_URL --evidence-dir "$tmp/evidence" | tee /tmp/rbac-scope-apply.out
grep -q '^PASS:' /tmp/rbac-scope-apply.out
second=$(bash "$root/scripts/production/safe-apply-migration.sh" --dry-run --file "$tmp/supabase/migrations/20261015110000_rbac_v2_scope_ambiguity_fix.sql" --db-url-env HOTFIX_DB_URL --evidence-dir "$tmp/evidence")
grep -q '^ALREADY_APPLIED:' <<<"$second"

after=$(curl -sS -o /tmp/rbac-scope-after.json -w '%{http_code}' -X POST "${headers[@]}" --data '{"p_actor_id":"30000000-0000-0000-0000-000000000001"}' "http://127.0.0.1:$api_port/rpc/api_list_role_permission_grants")
test "$after" = 200
grep -q 'scope.regression' /tmp/rbac-scope-after.json
grep -q '"scope":"all"' /tmp/rbac-scope-after.json

psql "$db" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
insert into public.user_permission_grants(user_id,permission_id,scope,effect,created_by)
select '30000000-0000-0000-0000-000000000001',id,'self','allow','30000000-0000-0000-0000-000000000001'
from public.permissions where code='scope.regression';
SQL
allow=$(curl -sS -o /tmp/rbac-scope-allow.json -w '%{http_code}' -X POST "${headers[@]}" --data '{"p_actor_id":"30000000-0000-0000-0000-000000000001"}' "http://127.0.0.1:$api_port/rpc/api_list_role_permission_grants")
test "$allow" = 200
grep -q '"scope":"self"' /tmp/rbac-scope-allow.json
! grep -q '"scope":"all"' /tmp/rbac-scope-allow.json
psql "$db" -v ON_ERROR_STOP=1 -c "update public.user_permission_grants set effect='deny' where user_id='30000000-0000-0000-0000-000000000001' and permission_id=(select id from public.permissions where code='scope.regression')" >/dev/null
deny=$(curl -sS -o /tmp/rbac-scope-deny.json -w '%{http_code}' -X POST "${headers[@]}" --data '{"p_actor_id":"30000000-0000-0000-0000-000000000001"}' "http://127.0.0.1:$api_port/rpc/api_list_role_permission_grants")
test "$deny" = 200
! grep -q 'scope.regression' /tmp/rbac-scope-deny.json
psql "$db" -v ON_ERROR_STOP=1 -c "delete from public.user_permission_grants where user_id='30000000-0000-0000-0000-000000000001' and permission_id=(select id from public.permissions where code='scope.regression')" >/dev/null

invalid=$(curl -sS -o /tmp/rbac-scope-invalid.json -w '%{http_code}' -X POST "${headers[@]}" --data '{"p_actor_id":"30000000-0000-0000-0000-000000000099"}' "http://127.0.0.1:$api_port/rpc/api_list_role_permission_grants")
test "$invalid" -ge 400
grep -q '42501' /tmp/rbac-scope-invalid.json
test "$(psql "$db" -Atqc "select has_function_privilege('service_role','public.api_list_role_permission_grants(uuid)','execute')")" = t
test "$(psql "$db" -Atqc "select has_function_privilege('anon','public.api_list_role_permission_grants(uuid)','execute')")" = f
test "$(psql "$db" -Atqc "select has_function_privilege('authenticated','public.api_list_role_permission_grants(uuid)','execute')")" = f
test "$(psql "$db" -Atqc "select pg_get_userbyid(proowner) from pg_proc where oid='public.api_list_role_permission_grants(uuid)'::regprocedure")" = postgres
state_after=$(psql "$db" -Atqc "select (select count(*) from roles),(select count(*) from staff_users),(select count(*) from role_permission_grants),(select count(*) from user_permission_grants)")
test "$state_after" = "$state_before"
echo "rbac-v2-scope-hotfix disposable regression: PASS (before_http=$before after_http=$after invalid_http=$invalid)"

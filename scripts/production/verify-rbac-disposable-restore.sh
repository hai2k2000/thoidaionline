#!/usr/bin/env bash
set -Eeuo pipefail

backup=${1:?backup path required}
canonical=${2:?canonical commit required}
[[ -f "$backup" && "$canonical" =~ ^[a-f0-9]{40}$ ]] || { echo "invalid restore arguments" >&2; exit 1; }
command -v docker >/dev/null || { echo "docker is required for PostgreSQL 17 restore" >&2; exit 1; }
command -v sha256sum >/dev/null || { echo "sha256sum is required" >&2; exit 1; }
source_db=${THOIDAI_RBAC_RESTORE_DB_URL:?source database URL required}
source_psql=${THOIDAI_RBAC_RESTORE_PSQL_BIN:-psql}
command -v "$source_psql" >/dev/null || [[ -x "$source_psql" ]] || { echo "psql is required for source comparison" >&2; exit 1; }
image=${THOIDAI_RBAC_RESTORE_IMAGE:-postgres:17.6}
[[ "$image" == postgres:17* ]] || { echo "restore image must be PostgreSQL 17" >&2; exit 1; }
backup_sha=$(sha256sum "$backup" | awk '{print $1}')
name="thoidai-rbac-restore-${RANDOM}-$$"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$name" --network none -e POSTGRES_PASSWORD=restore-only "$image" >/dev/null
for _ in $(seq 1 90); do docker exec "$name" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
docker exec "$name" pg_isready -U postgres >/dev/null
docker exec "$name" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'create role anon nologin; create role authenticated nologin; create role service_role nologin;' >/dev/null
docker exec "$name" createdb -U postgres restored >/dev/null
docker exec "$name" psql -U postgres -d restored -v ON_ERROR_STOP=1 -c 'create schema supabase_migrations;' >/dev/null
docker cp "$backup" "$name:/tmp/verified.dump"
docker exec "$name" pg_restore -U postgres --exit-on-error --no-owner --no-privileges --schema=public --schema=supabase_migrations -d restored /tmp/verified.dump >/dev/null
tables=$(docker exec "$name" psql -U postgres -d restored -Atqc "select case when to_regclass('public.staff_users') is not null and to_regclass('public.roles') is not null and to_regclass('public.permissions') is not null and to_regclass('supabase_migrations.schema_migrations') is not null then 'PASS' else 'FAIL' end")
[[ "$tables" == PASS ]] || { echo "required application tables missing after restore" >&2; exit 1; }
source_counts=$("$source_psql" --no-psqlrc -X -At --dbname "$source_db" -c "select (select count(*) from public.staff_users)||','||(select count(*) from public.roles)||','||(select count(*) from public.permissions)")
restored_counts=$(docker exec "$name" psql -U postgres -d restored -Atqc "select (select count(*) from public.staff_users)||','||(select count(*) from public.roles)||','||(select count(*) from public.permissions)")
[[ "$source_counts" == "$restored_counts" && "$restored_counts" != "0,0,0" ]] || { echo "application data comparison failed after restore" >&2; exit 1; }
ledger=$(docker exec "$name" psql -U postgres -d restored -Atqc "select string_agg(version, ',' order by version) from supabase_migrations.schema_migrations where version in ('20261015100000','20261015110000','20261015120000')")
source_ledger=$("$source_psql" --no-psqlrc -X -At --dbname "$source_db" -c "select string_agg(version, ',' order by version) from supabase_migrations.schema_migrations where version in ('20261015100000','20261015110000','20261015120000')")
[[ "$ledger" == "$source_ledger" && "$ledger" == "20261015100000,20261015110000,20261015120000" ]] || { echo "RBAC migration ledger comparison failed after restore" >&2; exit 1; }
printf '{"status":"PASS","postgres_major":"17","backup_sha256":"%s","canonical_commit":"%s","restore_target_id":"%s","application_tables":["staff_users","roles","permissions","supabase_migrations.schema_migrations"],"data_assertions":true,"ledger_versions":["20261015100000","20261015110000","20261015120000"],"supabase_extension_limits":"Restored public and supabase_migrations schemas only; Supabase auth, storage, realtime, and extension-managed objects are not part of this disposable verification target."}\n' "$backup_sha" "$canonical" "$name"

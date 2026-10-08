#!/usr/bin/env bash
set -Eeuo pipefail

root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd -P)
tmp=$(mktemp -d "${TMPDIR:-/tmp}/safe-per-file-migration.XXXXXX")
container="safe-per-file-migration-${RANDOM}-$$"
port=$((55432 + ($$ % 1000)))
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -rf -- "$tmp"
}
trap cleanup EXIT

mkdir -p "$tmp/supabase/migrations" "$tmp/evidence"
cat > "$tmp/supabase/migrations/20261008120000_disposable_runner.sql" <<'SQL'
create table public.safe_runner_fixture (id integer primary key);
SQL
cat > "$tmp/postcondition.sql" <<'SQL'
select case when to_regclass('public.safe_runner_fixture') is not null then 'pass' else 'fail' end;
SQL

docker run -d --name "$container" --network bridge --publish "127.0.0.1:${port}:5432" \
  --tmpfs /var/lib/postgresql/data:rw,size=256m \
  -e POSTGRES_PASSWORD=disposable-only -e POSTGRES_DB=runner \
  postgres:17 >/dev/null
for _ in $(seq 1 60); do
  if PGPASSWORD=disposable-only psql "postgresql://postgres@127.0.0.1:${port}/runner" -Atqc 'select 1' >/dev/null 2>&1; then break; fi
  sleep 1
done
PGPASSWORD=disposable-only psql "postgresql://postgres@127.0.0.1:${port}/runner" -v ON_ERROR_STOP=1 <<'SQL'
create schema supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text primary key,
  name text not null,
  statements text[] not null default '{}'
);
SQL

db_url="postgresql://postgres@127.0.0.1:${port}/runner"
export PGPASSWORD=disposable-only
export SAFE_MIGRATION_MIGRATIONS_DIR="$tmp/supabase/migrations"
export MIGRATION_EVIDENCE_DIR="$tmp/evidence"
runner=(bash "$root/scripts/production/safe-apply-migration.sh")

DISPOSABLE_DB_URL="$db_url" "${runner[@]}" --file "$tmp/supabase/migrations/20261008120000_disposable_runner.sql" --db-url-env DISPOSABLE_DB_URL --postcondition-sql "$tmp/postcondition.sql" --evidence-dir "$tmp/evidence" >/tmp/safe-runner-disposable.out
grep -q '^PASS:' /tmp/safe-runner-disposable.out
test "$(PGPASSWORD=disposable-only psql "$db_url" -Atqc "select count(*) from supabase_migrations.schema_migrations where version='20261008120000'")" = 1
fixture_state=$(PGPASSWORD=disposable-only psql "$db_url" -Atqc "select current_database(), coalesce(to_regclass('public.safe_runner_fixture')::text, 'missing'), count(*) from pg_class where relname='safe_runner_fixture'")
echo "fixture_state=$fixture_state"
test "$fixture_state" = "runner|safe_runner_fixture|1"
DISPOSABLE_DB_URL="$db_url" "${runner[@]}" --dry-run --file "$tmp/supabase/migrations/20261008120000_disposable_runner.sql" --db-url-env DISPOSABLE_DB_URL --evidence-dir "$tmp/evidence" >/tmp/safe-runner-disposable-dry-run.out
grep -q '^ALREADY_APPLIED:' /tmp/safe-runner-disposable-dry-run.out

echo "safe-per-file-migration disposable rehearsal: PASS"
echo "container=$container"
echo "ledger_rows=$(PGPASSWORD=disposable-only psql "$db_url" -Atqc "select count(*) from supabase_migrations.schema_migrations")"

#!/usr/bin/env bash

main() {
  set -Eeuo pipefail
  local status=INCOMPLETE
  local root=${THOIDAI_BACKUP_ROOT:-/opt/ops/thoidai-work/backups/managed}
  local daily="$root/daily"
  local image=public.ecr.aws/supabase/postgres:17.6.1.095
  local production=supabase_db_thoidai-work
  tmp="thoidai-restore-drill-$$"
  work=''
  local backup='' dump='' manifest='' storage=''
  local restore_log='' restore_errors=0
  local table tmp_count prod_count countable=0 count_error
  local tables=(public.staff_users public.tasks public.assets public.work_schedules public.db_records public.attendance_logs supabase_migrations.schema_migrations)

  cleanup() {
    local rc=$?
    if [[ -n "${tmp:-}" ]]; then docker rm -f -v "$tmp" >/dev/null 2>&1 || true; fi
    if [[ -n "${work:-}" && -d "${work:-}" ]]; then rm -rf -- "$work"; fi
    if (( rc != 0 )) && [[ "${status:-INCOMPLETE}" == INCOMPLETE ]]; then
      echo 'DRILL_STATUS=FAIL'
    fi
  }
  trap cleanup EXIT

  fail() { echo "DRILL_ERROR=$*" >&2; return 1; }
  [[ -d "$daily" ]] || fail "backup root missing: $daily"
  work=$(mktemp -d)
  restore_log="$work/restore.log"

  mapfile -t backups < <(find "$daily" -mindepth 1 -maxdepth 1 -type d -regextype posix-extended -regex '.*/[0-9]{8}T[0-9]{6}Z-daily$' -printf '%f\n' | sort -r)
  for entry in "${backups[@]}"; do
    candidate="$daily/$entry"
    [[ -f "$candidate/postgres.dump" && -f "$candidate/manifest.txt" ]] || continue
    backup="$candidate"
    break
  done
  [[ -n "$backup" ]] || fail 'no complete daily backup found'
  dump="$backup/postgres.dump"
  manifest="$backup/manifest.txt"
  storage="$backup/storage.tar.gz"
  [[ -f "$storage" ]] || fail 'storage.tar.gz missing'
  tar -tzf "$storage" >/dev/null || fail 'storage.tar.gz unreadable'
  expected_hash=$(awk '{ f = $2; sub(/^\*/, "", f) } f == "postgres.dump" || f ~ /\/postgres\.dump$/ { print $1; exit }' "$manifest")
  [[ "$expected_hash" =~ ^[[:xdigit:]]{64}$ ]] || fail 'postgres.dump hash missing from manifest'
  actual_hash=$(sha256sum "$dump" | awk '{print $1}')
  [[ "$actual_hash" == "$expected_hash" ]] || fail 'postgres.dump hash mismatch'

  docker run -d --name "$tmp" --network none --memory 512m \
    -e POSTGRES_PASSWORD=restore-drill-local-only "$image" >/dev/null
  for _ in $(seq 1 90); do
    if docker logs "$tmp" 2>&1 | grep -Fq 'PostgreSQL init process complete; ready for start up.'; then break; fi
    sleep 2
  done
  if ! docker logs "$tmp" 2>&1 | grep -Fq 'PostgreSQL init process complete; ready for start up.'; then
    echo 'POSTGRES_INIT_LOG_TAIL=' >&2
    docker logs "$tmp" 2>&1 | tail -n 30 | tr -cd '[:print:]\n' >&2
    fail 'postgres init timeout'
  fi
  ready_streak=0
  for _ in $(seq 1 90); do
    if docker exec "$tmp" pg_isready -h 127.0.0.1 -U supabase_admin -d postgres >/dev/null 2>&1 \
      && role_count=$(docker exec -i "$tmp" psql -h 127.0.0.1 -U supabase_admin -d postgres -Atc "select count(*) from pg_roles where rolname in ('supabase_admin','supabase_auth_admin','supabase_storage_admin','service_role');" </dev/null) \
      && [[ "$role_count" == 4 ]]; then
      ready_streak=$((ready_streak + 1))
      (( ready_streak >= 3 )) && break
    else
      ready_streak=0
    fi
    sleep 2
  done
  if (( ready_streak < 3 )); then
    echo 'POSTGRES_READY_LOG_TAIL=' >&2
    docker logs "$tmp" 2>&1 | tail -n 30 | tr -cd '[:print:]\n' >&2
    fail 'postgres readiness timeout'
  fi
  docker exec -i "$tmp" psql -h 127.0.0.1 -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
alter default privileges for role postgres in schema public revoke all on tables from postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on functions from postgres, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public revoke all on tables from postgres, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public revoke all on sequences from postgres, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public revoke all on functions from postgres, anon, authenticated, service_role;
SQL
  temp_default_acl_public=$(docker exec -i "$tmp" psql -h 127.0.0.1 -U supabase_admin -d postgres -Atc "select count(*) from pg_default_acl a join pg_namespace n on n.oid=a.defaclnamespace where n.nspname='public';" </dev/null)
  echo "TEMP_DEFAULT_ACL_PUBLIC=$temp_default_acl_public"
  [[ "$temp_default_acl_public" == 0 ]] || fail 'temporary default ACL is not empty'

  # Restore only application data; Supabase system schemas come from the image.
  migration_schema=$(docker exec -i "$tmp" psql -h 127.0.0.1 -U supabase_admin -d postgres -Atc "select 1 from pg_namespace where nspname='supabase_migrations';" </dev/null)
  if [[ "$migration_schema" == 1 ]]; then
    migration_table=$(docker exec -i "$tmp" psql -h 127.0.0.1 -U supabase_admin -d postgres -Atc "select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='supabase_migrations' and c.relname='schema_migrations' and c.relkind='r';" </dev/null)
    [[ "$migration_table" == 1 ]] && docker exec -i "$tmp" psql -h 127.0.0.1 -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c 'truncate table supabase_migrations.schema_migrations;' </dev/null >/dev/null
  else
    docker exec -i "$tmp" psql -h 127.0.0.1 -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c 'create schema supabase_migrations;' </dev/null >/dev/null
  fi

  set +e
  docker exec -i "$tmp" pg_restore --schema=public --schema=supabase_migrations -h 127.0.0.1 -U supabase_admin -d postgres < "$dump" >"$restore_log" 2>&1
  restore_rc=$?
  set -e
  restore_errors=$(grep -Eiv 'already exists' "$restore_log" | grep -Eic 'ERROR|FATAL' || true)
  echo "RESTORE_ERRORS=$restore_errors"
  grep -Ei 'ERROR|FATAL' "$restore_log" | grep -Eiv 'already exists' | sed -n '1,20p' || true

  for table in "${tables[@]}"; do
    count_error="$work/count-error"
    if ! tmp_count=$(docker exec -i "$tmp" psql -h 127.0.0.1 -U supabase_admin -d postgres -Atc "select count(*) from $table;" </dev/null 2>"$count_error"); then
      count_error=$(tr -cd '[:print:]\n' < "$count_error" | tr '\n' ' ' | cut -c1-300)
      fail "psql error for $table: $count_error"
    fi
    tmp_count=$(printf '%s' "$tmp_count" | tr -d '\r')
    if ! prod_count=$(docker exec -e PGOPTIONS='-c default_transaction_read_only=on' "$production" psql -U postgres -d postgres -Atc "select count(*) from $table;" 2>"$count_error"); then
      count_error=$(tr -cd '[:print:]\n' < "$count_error" | tr '\n' ' ' | cut -c1-300)
      fail "psql error for $table: $count_error"
    fi
    prod_count=$(printf '%s' "$prod_count" | tr -d '\r')
    [[ "$tmp_count" =~ ^[0-9]+$ && "$prod_count" =~ ^[0-9]+$ ]] || fail "invalid count for $table"
    countable=$((countable + 1))
    echo "RESTORE_${table}=$tmp_count/$prod_count"
    if [[ "$table" == supabase_migrations.schema_migrations ]]; then
      (( tmp_count == prod_count )) || fail "schema migration count mismatch"
    else
      (( tmp_count * 100 >= prod_count * 98 )) || fail "restore count below tolerance for $table"
    fi
  done
  (( restore_rc == 0 || countable > 0 )) || fail 'restore produced no countable tables'
  status=PASS
  echo 'DRILL_STATUS=PASS'
}

main "$@"; exit $?

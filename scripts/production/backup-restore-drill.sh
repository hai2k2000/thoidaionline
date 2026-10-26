#!/usr/bin/env bash

main() {
  set -Eeuo pipefail
  local status=INCOMPLETE
  local root=${THOIDAI_BACKUP_ROOT:-/opt/ops/thoidai-work/backups/managed}
  local daily="$root/daily"
  local image=public.ecr.aws/supabase/postgres:17.6.1.095
  local production=supabase_db_thoidai-work
  local tmp="thoidai-restore-drill-$$"
  local work=''
  local backup='' dump='' manifest='' storage=''
  local restore_log='' restore_errors=0
  local table tmp_count prod_count
  local tables=(public.staff_users public.tasks public.assets public.work_schedules public.db_records public.attendance_logs supabase_migrations.schema_migrations)

  cleanup() {
    local rc=$?
    if [[ -n "$tmp" ]]; then docker rm -f -v "$tmp" >/dev/null 2>&1 || true; fi
    if [[ -n "$work" && -d "$work" ]]; then rm -rf -- "$work"; fi
    if (( rc != 0 )) && [[ "$status" == INCOMPLETE ]]; then
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
  for _ in $(seq 1 120); do
    if docker logs "$tmp" 2>&1 | grep -Fq 'PostgreSQL init process complete'; then break; fi
    sleep 1
  done
  docker logs "$tmp" 2>&1 | grep -Fq 'PostgreSQL init process complete' || fail 'postgres init timeout'
  for _ in 1 2 3; do
    docker exec "$tmp" pg_isready -U postgres -d postgres >/dev/null || fail 'temporary postgres not ready'
    sleep 1
  done
  role_count=$(docker exec "$tmp" psql -U postgres -d postgres -Atc "select count(*) from pg_roles where rolname in ('postgres','supabase_admin','anon','authenticated');")
  [[ "$role_count" == 4 ]] || fail 'temporary role set incomplete'
  docker exec "$tmp" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'revoke all on schema public from public;' >/dev/null

  set +e
  docker exec -i "$tmp" pg_restore -h 127.0.0.1 -U supabase_admin -d postgres < "$dump" >"$restore_log" 2>&1
  restore_rc=$?
  set -e
  restore_errors=$(grep -Eic 'ERROR|FATAL' "$restore_log" || true)
  echo "RESTORE_ERRORS=$restore_errors"
  sed -n '1,20p' "$restore_log"
  (( restore_rc == 0 && restore_errors == 0 )) || fail 'restore reported errors'

  for table in "${tables[@]}"; do
    tmp_count=$(docker exec "$tmp" psql -U postgres -d postgres -Atc "select count(*) from $table;" | tr -d '\r')
    prod_count=$(docker exec "$production" psql -U postgres -d postgres -Atc "set default_transaction_read_only=on; select count(*) from $table;" | tr -d '\r')
    [[ "$tmp_count" =~ ^[0-9]+$ && "$prod_count" =~ ^[0-9]+$ ]] || fail "invalid count for $table"
    echo "RESTORE_${table}=$tmp_count/$prod_count"
    if [[ "$table" == supabase_migrations.schema_migrations ]]; then
      (( tmp_count == prod_count )) || fail "schema migration count mismatch"
    else
      (( tmp_count * 100 >= prod_count * 98 )) || fail "restore count below tolerance for $table"
    fi
  done
  status=PASS
  echo 'DRILL_STATUS=PASS'
}

main "$@"; exit $?

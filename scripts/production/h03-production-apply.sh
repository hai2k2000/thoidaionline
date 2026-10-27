#!/usr/bin/env bash
set -Eeuo pipefail

main() {
  local mode=verify-only
  [[ ${1:-} == --apply ]] && mode=apply && shift
  [[ ${1:-} == --verify-only ]] && mode=verify-only && shift
  [[ $# -eq 0 ]] || { echo "usage: $0 [--verify-only|--apply]" >&2; return 2; }
  : "${BUNDLE_DIR:?BUNDLE_DIR is required}"
  if [[ "$mode" == apply && ${THOIDAI_H03_APPLY_APPROVED:-} != APPROVE-NOT-APPLIED-PRODUCTION-2026-10-27 ]]; then
    echo "H03_FAIL=approval"
    return 1
  fi
  local root="$BUNDLE_DIR" apply_dir="$BUNDLE_DIR/scripts/production/h03-apply"
  local evidence_root=${H03_EVIDENCE_ROOT:-/opt/ops/thoidai-work/h03-evidence}
  local evidence="$evidence_root/prod-$(date -u +%Y%m%dT%H%M%SZ)"
  mkdir -p "$evidence"; chmod 700 "$evidence"
  local run_start_epoch; run_start_epoch=$(date +%s)
  local migrations="$BUNDLE_DIR/supabase/migrations" order="$apply_dir/order.txt"
  local safe="$BUNDLE_DIR/scripts/production/safe-apply-migration.sh"
  [[ -d "$migrations" && -f "$order" && -x "$safe" ]] || { echo "H03_FAIL=preflight"; return 1; }
  local tmp; tmp=$(mktemp -d); trap 'rm -rf "${tmp:-}"' EXIT
  local psql_wrap="$tmp/psql-wrapper"
  cat >"$psql_wrap" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
args=()
skip=0
for arg in "$@"; do
  if [[ $skip -eq 1 ]]; then skip=0; continue; fi
  case "$arg" in
    -h|--host|-p|--port|-U|--username|-d|--dbname) skip=1 ;;
    --host=*|--port=*|--username=*|--dbname=*) ;;
    *) args+=("$arg") ;;
  esac
done
# -q: container psql 17 prints command tags (DO) for -c, which breaks safe-apply postcondition parsing.
exec docker exec -i supabase_db_thoidai-work psql -q -h 127.0.0.1 -U supabase_admin --dbname postgres "${args[@]}"
EOF
  chmod 700 "$psql_wrap"
  export SAFE_MIGRATION_PSQL_BIN="$psql_wrap" SAFE_MIGRATION_MIGRATIONS_DIR="$migrations"
  export H03_DB_URL="postgresql://supabase_admin@127.0.0.1:5432/postgres"

  fail() { echo "H03_FAIL=$1"; return 1; }
  ro_sql() { printf 'begin transaction read only;\n%s;\ncommit;\n' "$1" | "$psql_wrap" --no-psqlrc -X -qAt --set ON_ERROR_STOP=1 --dbname postgres -f -; }
  ro_file() { { printf 'begin transaction read only;\n'; command cat "$1"; printf '\ncommit;\n'; } | "$psql_wrap" --no-psqlrc -X -qAt --set ON_ERROR_STOP=1 --dbname postgres -f -; }
  scalar() { ro_sql "$1" | tr -d '\r' | sed '/^$/d' | tail -n 1; }
  disk_free() { df -Pk / | awk 'NR==2 {print $4}'; }
  echo "DISK_FREE_KB=$(disk_free)"
  [[ "$(scalar 'select current_user')" == supabase_admin ]] || fail identity
  local ledger; ledger=$(scalar 'select count(*) from supabase_migrations.schema_migrations')
  [[ "$ledger" == 167 ]] || fail ledger
  echo "LEDGER_COUNT=$ledger"
  ro_file "$apply_dir/absent.sql" >"$evidence/absent.txt" || fail absent
  local verify_out="$evidence/verify-before.txt"
  ro_file "$root/scripts/production/verify-anon-lockdown.sql" >"$verify_out" || fail verify-before
  awk -F'|' '{if ($2 != "" && ($1 ~ /_LEAK$/ || $1 == "RLS_OFF_COUNT" || $1 ~ /^SERVICE_ROLE_MISSING_/)) print $1 "=" $2}' "$verify_out"
  awk -F'|' '$1 ~ /_LEAK$/ || $1 == "RLS_OFF_COUNT" || $1 ~ /^SERVICE_ROLE_MISSING_/ {if (($2+0) != 0) bad=1} END {exit bad}' "$verify_out" || fail lockdown-before
  echo "APPLY_PLAN"; sed '/^[[:space:]]*$/d' "$order"
  local restarts_before; restarts_before=$(systemctl show thoidai-work -p NRestarts --value 2>/dev/null || true)
  if [[ "$mode" == verify-only ]]; then echo "H03_VERIFY=PASS"; echo "EVIDENCE=$evidence"; return 0; fi
  local backup_unit=thoidai-backup.service
  if ! systemctl list-unit-files "$backup_unit" --no-legend 2>/dev/null | awk 'NF {found=1} END {exit !found}'; then
    backup_unit=$(systemctl list-unit-files 'thoidai-backup*' --no-legend 2>/dev/null | awk 'NF {print $1; exit}')
  fi
  [[ -n "$backup_unit" ]] || fail backup-unit
  systemctl start "$backup_unit" || fail backup-start
  [[ "$(systemctl show -p Result --value "$backup_unit" 2>/dev/null || true)" == success ]] || fail backup-result
  local backup_dir=""
  local backup_root=${H03_BACKUP_ROOT:-/opt/ops/thoidai-work/backups/managed}
  # last-success holds "<utc-time> <backup-dir-name> <n>"; the dir lives under daily/ (thoidai-backup layout).
  if [[ -f "$backup_root/last-success" && $(stat -c %Y "$backup_root/last-success") -ge $run_start_epoch ]]; then
    backup_dir="$backup_root/daily/$(awk 'END {print $2}' "$backup_root/last-success")"
  fi
  if [[ ! -f "$backup_dir/postgres.dump" ]]; then backup_dir=$(find "$backup_root/daily" -mindepth 1 -maxdepth 1 -type d -newermt "@$run_start_epoch" -print 2>/dev/null | sort | tail -n 1); fi
  [[ -n "$backup_dir" && -f "$backup_dir/postgres.dump" ]] || fail backup-artifact
  printf 'BACKUP_PATH=%s\n' "$backup_dir" >"$evidence/backup.txt"
  sha256sum "$backup_dir/postgres.dump" >>"$evidence/backup.txt" || fail backup-hash
  local file base start status elapsed post
  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    base=$(basename "$file"); start=$(date +%s); post="$apply_dir/post/$base"
    if "$safe" --file "$migrations/$base" --db-url-env H03_DB_URL --postcondition-sql "$post" --evidence-dir "$evidence"; then status=PASS; else status=FAIL; fi
    elapsed=$(( $(date +%s) - start )); printf 'STEP\t%s\t%s\t%s\n' "$base" "$status" "$elapsed" | tee -a "$evidence/steps.tsv"
    [[ "$status" == PASS ]] || { echo "ROLLBACK_HINT=$apply_dir/rollback.sql"; fail "$base"; }
  done < "$order"
  [[ "$(scalar 'select count(*) from supabase_migrations.schema_migrations')" == 183 ]] || fail ledger-after
  local verify_after="$evidence/verify-after.txt"
  ro_file "$root/scripts/production/verify-anon-lockdown.sql" >"$verify_after" || fail verify-after
  awk -F'|' '$1 ~ /_LEAK$/ || $1 == "RLS_OFF_COUNT" || $1 ~ /^SERVICE_ROLE_MISSING_/ {print $1 "=" $2}' "$verify_after"
  awk -F'|' 'NR==FNR {before[$1]=$2; next} ($1 ~ /_LEAK$/ || $1 == "RLS_OFF_COUNT") && ($2+0 > before[$1]+0) {bad=1} END {exit bad}' "$verify_out" "$verify_after" || fail lockdown-after
  [[ "$(systemctl show thoidai-work -p NRestarts --value 2>/dev/null || true)" == "$restarts_before" ]] || fail restarts
  [[ "$(curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/login)" == 200 ]] || fail health-local
  [[ "$(curl -fsS -o /dev/null -w '%{http_code}' https://thoidai.online/login)" == 200 ]] || fail health-public
  echo "JOURNAL_PERMISSION_OR_42501=$(journalctl -u thoidai-work --since '-20 min' 2>/dev/null | grep -Eic 'permission denied|42501' || true)"
  echo "H03_APPLY=PASS"; echo "EVIDENCE=$evidence"
}

main "$@" </dev/null

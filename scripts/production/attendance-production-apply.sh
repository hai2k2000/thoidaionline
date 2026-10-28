#!/usr/bin/env bash
set -Eeuo pipefail

# A git-archive bundle may omit MIGRATION_REFERENCE. Generate it before packaging
# with one migration path per line, copied from the migrationReference list in
# scripts/package-standalone.mjs; this script fails closed when the file is absent.

main() {
  local mode=verify-only
  [[ ${1:-} == --apply ]] && mode=apply && shift
  [[ ${1:-} == --verify-only ]] && mode=verify-only && shift
  [[ $# -eq 0 ]] || { echo 'usage: $0 [--verify-only|--apply]' >&2; return 2; }
  : "${BUNDLE_DIR:?BUNDLE_DIR is required}"
  if [[ "$mode" == apply && ${THOIDAI_ATTENDANCE_PROD_APPROVED:-} != APPROVE-ATTENDANCE-PRODUCTION ]]; then
    echo 'ATTENDANCE_PROD_APPLY=FAIL step=approval'
    return 1
  fi

  local evidence_root=${ATTENDANCE_EVIDENCE_ROOT:-/opt/ops/thoidai-work/attendance-evidence}
  local evidence="$evidence_root/prod-$(date -u +%Y%m%dT%H%M%SZ)"
  mkdir -p "$evidence"; chmod 700 "$evidence"
  local step=preflight
  fail() {
    [[ -n "${1:-}" ]] && step=$1
    echo "ATTENDANCE_PROD_APPLY=FAIL step=$step" >&2
    echo "REVERT_COMMAND=docker exec -i supabase_db_thoidai-work psql -q -h 127.0.0.1 -U supabase_admin --dbname postgres -f $BUNDLE_DIR/scripts/production/attendance-workday-adjustments-revert.sql" >&2
    echo "REVERT_COMMAND=docker exec -i supabase_db_thoidai-work psql -q -h 127.0.0.1 -U supabase_admin --dbname postgres -f $BUNDLE_DIR/scripts/production/attendance-late-exception-review-revert.sql" >&2
    echo "REVERT_COMMAND=docker exec -i supabase_db_thoidai-work psql -q -h 127.0.0.1 -U supabase_admin --dbname postgres -f $BUNDLE_DIR/scripts/production/attendance-rbac-v1-revert.sql" >&2
    echo "REVERT_COMMAND=docker exec -i supabase_db_thoidai-work psql -q -h 127.0.0.1 -U supabase_admin --dbname postgres -c \"delete from supabase_migrations.schema_migrations where version in ('20261028150000','20261028160000','20261028170000')\"" >&2
    return 1
  }

  "$BUNDLE_DIR/scripts/production/disk-guard.sh" || fail disk-guard
  mkdir -p /run/lock
  exec 9>/run/lock/thoidai-work-deploy.lock
  flock -n 9 || { step=deploy-lock; fail; }

  local tmp; tmp=$(mktemp -d); trap 'rm -rf -- "${tmp:-}"' EXIT
  local psql_wrap="$tmp/psql-wrapper"
  cat >"$psql_wrap" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
args=(); skip=0
for arg in "$@"; do
  if [[ $skip -eq 1 ]]; then skip=0; continue; fi
  case "$arg" in
    -h|--host|-p|--port|-U|--username|-d|--dbname) skip=1 ;;
    --host=*|--port=*|--username=*|--dbname=*) ;;
    *) args+=("$arg") ;;
  esac
done
exec docker exec -i supabase_db_thoidai-work psql -q -h 127.0.0.1 -U supabase_admin --dbname postgres "${args[@]}"
EOF
  chmod 700 "$psql_wrap"
  local migrations="$BUNDLE_DIR/supabase/migrations" safe="$BUNDLE_DIR/scripts/production/safe-apply-migration.sh"
  [[ -x "$safe" ]] || fail safe-apply-missing
  [[ -f "$BUNDLE_DIR/MIGRATION_REFERENCE" ]] || fail migration-reference-missing
  export ATTENDANCE_DB_URL='postgresql://supabase_admin@127.0.0.1:5432/postgres'
  ro_sql() { printf 'begin transaction read only;\n%s;\ncommit;\n' "$1" | "$psql_wrap" --no-psqlrc -X -qAt --set ON_ERROR_STOP=1 --dbname postgres -f -; }
  scalar() { ro_sql "$1" | tr -d '\r' | sed '/^$/d' | tail -n 1; }

  step=ledger
  local ledger_before allowed version file
  ledger_before=$(scalar 'select count(*) from supabase_migrations.schema_migrations')
  [[ "$(scalar "select count(*) from supabase_migrations.schema_migrations where version='20261028100000'")" == 1 ]] || fail ledger-rbac-required
  allowed='20261028150000,20261028160000,20261028170000'
  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    version=$(basename "$file" | cut -d_ -f1)
    if [[ "$(scalar "select count(*) from supabase_migrations.schema_migrations where version='${version}'")" != 1 ]]; then
      echo "MISSING|$file"
      case ",$allowed," in *",$version,"*) ;; *) fail ledger-allowlist ;; esac
    elif [[ ",$allowed," == *",$version,"* ]]; then
      fail ledger-allowlist
    fi
  done < "$BUNDLE_DIR/MIGRATION_REFERENCE"
  for version in 20261028150000 20261028160000 20261028170000; do
    [[ "$(scalar "select count(*) from supabase_migrations.schema_migrations where version='${version}'")" == 0 ]] || fail ledger-allowlist
  done
  echo "LEDGER_COUNT=$ledger_before"

  step=pre-state
  ro_sql "select p.proname || '|' || md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('rbac_v2_scope_supported','api_upsert_attendance_admin_note') order by p.proname" | tee "$evidence/pre-md5.txt"
  if [[ "$mode" == verify-only ]]; then
    echo 'ATTENDANCE_PROD_APPLY=VERIFY_ONLY_PASS'; echo "EVIDENCE=$evidence"; return 0
  fi

  step=backup
  local run_start_epoch backup_unit backup_root backup_dir
  run_start_epoch=$(date +%s); backup_unit=thoidai-backup.service
  systemctl start "$backup_unit" || fail backup-start
  [[ "$(systemctl show -p Result --value "$backup_unit" 2>/dev/null || true)" == success ]] || fail backup-result
  backup_root=${ATTENDANCE_BACKUP_ROOT:-/opt/ops/thoidai-work/backups/managed}
  backup_dir=''
  if [[ -f "$backup_root/last-success" && $(stat -c %Y "$backup_root/last-success") -ge $run_start_epoch ]]; then backup_dir="$backup_root/daily/$(awk 'END {print $2}' "$backup_root/last-success")"; fi
  [[ -f "$backup_dir/postgres.dump" ]] || backup_dir=$(find "$backup_root/daily" -mindepth 1 -maxdepth 1 -type d -newermt "@$run_start_epoch" -print 2>/dev/null | sort | tail -n 1)
  [[ -f "$backup_dir/postgres.dump" ]] || fail backup-artifact
  printf 'BACKUP_PATH=%s\n' "$backup_dir" | tee "$evidence/backup.txt"
  sha256sum "$backup_dir/postgres.dump" | tee -a "$evidence/backup.txt" >/dev/null || fail backup-hash

  local post_150000="$tmp/post-150000.sql" post_160000="$tmp/post-160000.sql" post_170000="$tmp/post-170000.sql"
  cat >"$post_150000" <<'SQL'
select case when
  exists (select 1 from public.permissions where code='attendance.manage')
  and exists (select 1 from information_schema.columns where table_schema='public' and table_name='staff_users' and column_name='attendance_exempt')
  and public.rbac_v2_scope_supported('attendance.view_all','department')
then 'pass' else 'fail' end;
SQL
  cat >"$post_160000" <<'SQL'
select case when
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('api_request_late_exception','api_review_late_exception','api_list_reviewable_late_exceptions'))=3
  and position('r.code = ''admin''' in pg_get_functiondef('public.api_upsert_attendance_admin_note(uuid,uuid,date,text)'::regprocedure))=0
then 'pass' else 'fail' end;
SQL
  cat >"$post_170000" <<'SQL'
select case when exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='attendance_workday_adjustments' and c.relkind='r' and c.relrowsecurity) then 'pass' else 'fail' end;
SQL

  step=safe-apply-150000
  SAFE_MIGRATION_PSQL_BIN="$psql_wrap" SAFE_MIGRATION_MIGRATIONS_DIR="$migrations" "$safe" --file "$migrations/20261028150000_attendance_rbac_v1.sql" --db-url-env ATTENDANCE_DB_URL --postcondition-sql "$post_150000" --evidence-dir "$evidence" || fail safe-apply-150000
  step=safe-apply-160000
  SAFE_MIGRATION_PSQL_BIN="$psql_wrap" SAFE_MIGRATION_MIGRATIONS_DIR="$migrations" "$safe" --file "$migrations/20261028160000_attendance_late_exception_review.sql" --db-url-env ATTENDANCE_DB_URL --postcondition-sql "$post_160000" --evidence-dir "$evidence" || fail safe-apply-160000
  step=safe-apply-170000
  SAFE_MIGRATION_PSQL_BIN="$psql_wrap" SAFE_MIGRATION_MIGRATIONS_DIR="$migrations" "$safe" --file "$migrations/20261028170000_attendance_workday_adjustments.sql" --db-url-env ATTENDANCE_DB_URL --postcondition-sql "$post_170000" --evidence-dir "$evidence" || fail safe-apply-170000

  step=post-checks
  for version in 20261028150000 20261028160000 20261028170000; do
    [[ "$(scalar "select count(*) from supabase_migrations.schema_migrations where version='${version}'")" == 1 ]] || fail ledger-after
  done
  local exempt_count; exempt_count=$(scalar 'select count(*) from public.staff_users where attendance_exempt')
  echo "ATTENDANCE_EXEMPT_COUNT=$exempt_count"; [[ "$exempt_count" == 3 ]] || fail attendance-exempt
  [[ "$(scalar "select count(*) from information_schema.role_table_grants where table_schema='public' and table_name='attendance_workday_adjustments' and grantee in ('anon','authenticated') and privilege_type <> ''")" == 0 ]] || fail lockdown-table
  [[ "$(scalar "select count(*) from (values ('api_request_late_exception(uuid,date,text)'),('api_review_late_exception(uuid,uuid,text,text)'),('api_list_reviewable_late_exceptions(uuid,date,date)'),('api_upsert_attendance_admin_note(uuid,uuid,date,text)'),('api_upsert_attendance_workday_adjustment(uuid,uuid,date,numeric,text)'),('api_delete_attendance_workday_adjustment(uuid,uuid,date)')) f(sig) join pg_proc p on p.oid=('public.'||sig)::regprocedure where has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute') or p.proacl is null or exists (select 1 from aclexplode(p.proacl) a where a.grantee=0 and a.privilege_type='EXECUTE')")" == 0 ]] || fail lockdown-functions
  [[ "$(scalar "select count(*) from pg_class where oid='public.attendance_workday_adjustments'::regclass and relrowsecurity")" == 1 ]] || fail lockdown-rls
  [[ "$(scalar "select public.rbac_v2_scope_supported('leave.approve','department')")" == t ]] || fail rbac-approval

  step=health
  local http_status; http_status=$(curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/login) || fail health
  [[ "$http_status" == 200 || "$http_status" == 307 ]] || fail health
  echo 'ATTENDANCE_PROD_APPLY=PASS'; echo "EVIDENCE=$evidence"
}

main "$@" </dev/null

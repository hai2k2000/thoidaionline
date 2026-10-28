#!/usr/bin/env bash
set -Eeuo pipefail

main() {
  local mode=verify-only
  [[ ${1:-} == --apply ]] && mode=apply && shift
  [[ ${1:-} == --verify-only ]] && mode=verify-only && shift
  [[ $# -eq 0 ]] || { echo 'usage: $0 [--verify-only|--apply]' >&2; return 2; }
  : "${BUNDLE_DIR:?BUNDLE_DIR is required}"
  if [[ "$mode" == apply && ${THOIDAI_RBAC_PROD_APPROVED:-} != APPROVE-RBAC-APPROVAL-PRODUCTION ]]; then
    echo 'RBAC_PROD_APPLY=FAIL step=approval'
    return 1
  fi

  local evidence_root=${RBAC_EVIDENCE_ROOT:-/opt/ops/thoidai-work/rbac-approval-evidence}
  local evidence="$evidence_root/prod-$(date -u +%Y%m%dT%H%M%SZ)"
  mkdir -p "$evidence"; chmod 700 "$evidence"
  local step=preflight
  fail() {
    [[ -n "${1:-}" ]] && step=$1
    echo "RBAC_PROD_APPLY=FAIL step=$step" >&2
    echo "REVERT_COMMAND=docker exec -i supabase_db_thoidai-work psql -q -h 127.0.0.1 -U supabase_admin --dbname postgres -f $BUNDLE_DIR/scripts/production/rbac-approval-v1-revert.sql" >&2
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
# Same secret-free admin path as h03-production-apply.sh (container loopback is trust for supabase_admin).
exec docker exec -i supabase_db_thoidai-work psql -q -h 127.0.0.1 -U supabase_admin --dbname postgres "${args[@]}"
EOF
  chmod 700 "$psql_wrap"
  local migrations="$BUNDLE_DIR/supabase/migrations" safe="$BUNDLE_DIR/scripts/production/safe-apply-migration.sh"
  [[ -x "$safe" && -f "$BUNDLE_DIR/MIGRATION_REFERENCE" ]] || { step=preflight; fail; }
  export RBAC_DB_URL="postgresql://supabase_admin@127.0.0.1:5432/postgres"
  ro_sql() { printf 'begin transaction read only;\n%s;\ncommit;\n' "$1" | "$psql_wrap" --no-psqlrc -X -qAt --set ON_ERROR_STOP=1 --dbname postgres -f -; }
  ro_file() { { printf 'begin transaction read only;\n'; command cat "$1"; printf '\ncommit;\n'; } | "$psql_wrap" --no-psqlrc -X -qAt --set ON_ERROR_STOP=1 --dbname postgres -f -; }
  scalar() { ro_sql "$1" | tr -d '\r' | sed '/^$/d' | tail -n 1; }
  local ledger_before expected_missing allowed missing version file

  step=ledger
  ledger_before=$(scalar 'select count(*) from supabase_migrations.schema_migrations')
  # CSDL versions 20261027140000, 20261027160000, 20261028090000 and
  # 20261028120000 may still be absent; apply them separately with owner
  # approval or explicitly widen RBAC_ALLOWED_MISSING.
  allowed="${RBAC_ALLOWED_MISSING:-20261028100000}"
  expected_missing=0
  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    version=$(basename "$file" | cut -d_ -f1)
    if [[ "$(scalar "select count(*) from supabase_migrations.schema_migrations where version='${version}'")" != 1 ]]; then
      echo "MISSING|$file"; expected_missing=$((expected_missing + 1))
      case ",$allowed," in *",$version,"*) ;; *) fail ledger-allowlist ;; esac
    fi
  done < "$BUNDLE_DIR/MIGRATION_REFERENCE"
  echo "LEDGER_COUNT=$ledger_before"

  step=pre-state
  local md5_out="$evidence/pre-md5.txt"
  ro_sql "select p.proname || '|' || md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('api_review_leave_request','api_review_personal_work_schedule','rbac_v2_scope_supported') order by p.proname" | tee "$md5_out"
  grep -Fx 'api_review_leave_request|a68fcf7a399f8ffec851841bf2585b4f' "$md5_out" >/dev/null || fail pre-md5
  grep -Fx 'api_review_personal_work_schedule|39b3913aca8268e85c5fdfd1d0226971' "$md5_out" >/dev/null || fail pre-md5
  grep -Fx 'rbac_v2_scope_supported|869b5467706e36f844dcee79374bbd65' "$md5_out" >/dev/null || fail pre-md5
  ro_sql "select 'PENDING_LEAVE|' || count(*) from public.leave_requests where status='pending'; select 'PENDING_PERSONAL_PLAN|' || count(*) from public.work_schedules where schedule_scope='personal' and approval_status='PENDING_APPROVAL'; select 'ACTIVE_ROLE|' || lower(r.code) || '|' || count(*) from public.staff_users u join public.roles r on r.id=u.role_id where u.active and lower(r.code) in ('tong_bien_tap','pho_tong_bien_tap','admin') group by lower(r.code); select 'ACTIVE_JOB|truong_phong|' || count(*) from public.staff_users u join public.job_titles j on j.id=u.job_title_id where u.active and lower(j.code)='truong_phong'" | tee "$evidence/pre-counts.txt"
  local restarts_before; restarts_before=$(systemctl show thoidai-work -p NRestarts --value 2>/dev/null || true)
  if [[ "$mode" == verify-only ]]; then
    echo 'RBAC_PROD_VERIFY_ONLY=PASS'; echo "EVIDENCE=$evidence"; return 0
  fi

  step=backup
  local run_start_epoch backup_unit backup_root backup_dir
  run_start_epoch=$(date +%s); backup_unit=thoidai-backup.service
  systemctl start "$backup_unit" || fail backup-start
  [[ "$(systemctl show -p Result --value "$backup_unit" 2>/dev/null || true)" == success ]] || fail backup-result
  backup_root=${RBAC_BACKUP_ROOT:-/opt/ops/thoidai-work/backups/managed}
  backup_dir=''
  if [[ -f "$backup_root/last-success" && $(stat -c %Y "$backup_root/last-success") -ge $run_start_epoch ]]; then backup_dir="$backup_root/daily/$(awk 'END {print $2}' "$backup_root/last-success")"; fi
  [[ -f "$backup_dir/postgres.dump" ]] || backup_dir=$(find "$backup_root/daily" -mindepth 1 -maxdepth 1 -type d -newermt "@$run_start_epoch" -print 2>/dev/null | sort | tail -n 1)
  [[ -f "$backup_dir/postgres.dump" ]] || fail backup-artifact
  printf 'BACKUP_PATH=%s\n' "$backup_dir" | tee "$evidence/backup.txt"
  sha256sum "$backup_dir/postgres.dump" | tee -a "$evidence/backup.txt" >/dev/null || fail backup-hash

  step=safe-apply
  local migration="$migrations/20261028100000_rbac_approval_permissions_v1.sql" post="$BUNDLE_DIR/scripts/production/rbac-approval/post/20261028100000_rbac_approval_permissions_v1.sql"
  [[ -f "$migration" && -f "$post" ]] || fail migration-files
  SAFE_MIGRATION_PSQL_BIN="$psql_wrap" SAFE_MIGRATION_MIGRATIONS_DIR="$migrations" "$safe" --file "$migration" --db-url-env RBAC_DB_URL --postcondition-sql "$post" --evidence-dir "$evidence" || fail safe-apply

  step=post-checks
  [[ "$(scalar "select count(*) from supabase_migrations.schema_migrations where version='20261028100000'")" == 1 ]] || fail ledger-after
  [[ "$(scalar "select count(*) from public.permissions where code in ('leave.approve','schedule.business.approve','schedule.event.approve')")" == 3 ]] || fail permission-rows
  # Seeded approval grants: admin/TBT/PTBT -> all three codes at 'all'; phu_trach_phong_* -> leave.approve at 'department'.
  local approval_codes="'leave.approve','schedule.business.approve','schedule.event.approve'"
  local seeded_grant="(g.scope='all' and g.role_id in (select id from public.roles where code in ('admin','tong_bien_tap','pho_tong_bien_tap')))"
  seeded_grant="($seeded_grant or (p.code='leave.approve' and g.scope='department' and g.role_id in (select id from public.roles where code in ('phu_trach_phong_tri_su','phu_trach_phong_phong_vien','phu_trach_phong_bien_tap'))))"
  local approval_grants="from public.role_permission_grants g join public.permissions p on p.id=g.permission_id where p.code in ($approval_codes)"
  [[ "$(scalar "select count(*) $approval_grants and $seeded_grant")" == 12 ]] || fail role-grants
  [[ "$(scalar "select count(*) $approval_grants and not $seeded_grant")" == 0 ]] || fail role-grants
  [[ "$(scalar "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('approval_effective_scopes','approval_review_basis','approval_assert_can_review','api_review_leave_request','api_review_personal_work_schedule','api_list_reviewable_leave_requests','api_list_reviewable_personal_plans','api_get_approval_capabilities','api_list_user_approval_permissions','api_list_user_permission_history') and has_function_privilege('service_role',p.oid,'execute') and not has_function_privilege('anon',p.oid,'execute') and not has_function_privilege('authenticated',p.oid,'execute') and not has_function_privilege('public',p.oid,'execute')")" == 10 ]] || fail execute-grants
  ro_sql "select p.proname || '|' || md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('api_review_leave_request','api_review_personal_work_schedule','rbac_v2_scope_supported') order by p.proname" | tee "$evidence/post-md5.txt"

  step=equivalence-smoke
  ro_sql "select lower(coalesce(r.code,'(none)')) || '|' || lower(coalesce(j.code,'(none)')) || '|' || count(*) from public.staff_users u left join public.roles r on r.id=u.role_id left join public.job_titles j on j.id=u.job_title_id cross join lateral public.api_get_approval_capabilities(u.id) c where u.active group by 1,2 order by 1,2" | tee "$evidence/capabilities-by-role-job.txt"
  [[ "$(scalar "select count(*) from public.staff_users u join public.roles r on r.id=u.role_id cross join lateral public.api_get_approval_capabilities(u.id) c where u.active and lower(r.code) in ('tong_bien_tap','pho_tong_bien_tap','admin') and coalesce(c->'leave.approve'->>'scopes','') not like '%all%'")" == 0 ]] || fail capabilities-role
  [[ "$(scalar "select count(*) from public.staff_users u join public.job_titles j on j.id=u.job_title_id cross join lateral public.api_get_approval_capabilities(u.id) c where u.active and lower(j.code)='truong_phong' and (coalesce(c->'leave.approve'->>'scopes','') not like '%department%' or coalesce(c->'schedule.business.approve'->>'scopes','') not like '%department%' or coalesce(c->'schedule.event.approve'->>'scopes','') not like '%department%')")" == 0 ]] || fail capabilities-job
  [[ "$(scalar "select count(*) from public.staff_users u cross join lateral public.api_get_approval_capabilities(u.id) c where u.active and not exists (select 1 from public.roles r where r.id=u.role_id and lower(r.code) in ('tong_bien_tap','pho_tong_bien_tap','admin')) and not exists (select 1 from public.job_titles j where j.id=u.job_title_id and lower(j.code)='truong_phong') and (c->'leave.approve'->'scopes' <> '[]'::jsonb or c->'schedule.business.approve'->'scopes' <> '[]'::jsonb or c->'schedule.event.approve'->'scopes' <> '[]'::jsonb)")" == 0 ]] || fail capabilities-unexpected

  step=health
  [[ "$(curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/login)" == 200 ]] || fail health
  [[ "$(systemctl show thoidai-work -p NRestarts --value 2>/dev/null || true)" == "$restarts_before" ]] || fail restarts
  echo 'RBAC_PROD_APPLY=PASS'; echo "EVIDENCE=$evidence"
}

main "$@" </dev/null

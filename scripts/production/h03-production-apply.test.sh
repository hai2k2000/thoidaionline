#!/usr/bin/env bash
set -Eeuo pipefail
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd -P)
work=$(mktemp -d); trap 'rm -rf "$work"' EXIT
bin="$work/bin"; state="$work/state"; mkdir -p "$bin" "$state" "$work/evidence" "$work/backups"
log="$state/calls"; : >"$log"
cat >"$bin/docker" <<'EOF'
#!/usr/bin/env bash
echo docker "$@" >>"$H03_TEST_LOG"
input=$(cat)
if [[ "$input" == *"select current_user"* ]]; then echo supabase_admin; elif [[ "$input" == *"select count(*) from supabase_migrations"* ]]; then echo 167; elif [[ "$input" == *"TABLE_LEAK"* ]]; then printf '%s\n' 'DEFAULT_ACL_LEAK|0' 'FUNCTION_LEAK|0' 'POLICY_LEAK|0' 'RLS_OFF_COUNT|0' 'SERVICE_ROLE_MISSING_DML_ON_EXPOSED|0' 'SERVICE_ROLE_MISSING_SELECT|0' 'SERVICE_ROLE_RPC_EXECUTE_COUNT|7' 'STORAGE_ANON_POLICY|0' 'STORAGE_OBJECTS_ANON_GRANT|0' 'STORAGE_PUBLIC_BUCKETS|0' 'TABLE_LEAK|0'; fi
EOF
cat >"$bin/systemctl" <<'EOF'
#!/usr/bin/env bash
echo systemctl "$@" >>"$H03_TEST_LOG"
case "$*" in *"list-unit-files thoidai-backup.service"*) echo 'thoidai-backup.service enabled';; *"show -p Result"*) echo success;; *"show thoidai-work"*) echo 0;; esac
EOF
cat >"$bin/curl" <<'EOF'
#!/usr/bin/env bash
echo curl "$@" >>"$H03_TEST_LOG"; echo 200
EOF
cat >"$bin/journalctl" <<'EOF'
#!/usr/bin/env bash
echo journalctl "$@" >>"$H03_TEST_LOG"
EOF
cat >"$bin/sha256sum" <<'EOF'
#!/usr/bin/env bash
echo deadbeef  "$1"
EOF
chmod +x "$bin"/*
export PATH="$bin:$PATH" H03_TEST_LOG="$log" BUNDLE_DIR="$root" H03_EVIDENCE_ROOT="$work/evidence" H03_BACKUP_ROOT="$work/backups"
if "$root/scripts/production/h03-production-apply.sh" --apply >"$state/no-token.out" 2>&1; then echo 'expected approval failure' >&2; exit 1; fi
! grep -Eq 'systemctl start' "$log" || { echo 'backup mutated before approval' >&2; exit 1; }
rm -f "$log"; touch "$log"
if "$root/scripts/production/h03-production-apply.sh" --verify-only >"$state/verify.out" 2>&1; then :; else cat "$state/verify.out"; exit 1; fi
! grep -Eq 'systemctl start|docker exec.*begin' "$log" || { echo 'verify-only mutated' >&2; exit 1; }
bundle="$work/bundle"; mkdir -p "$bundle"; cp -R "$root/supabase" "$bundle/"; cp -R "$root/scripts" "$bundle/"
cat >"$bundle/scripts/production/safe-apply-migration.sh" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
echo safe-apply "$@" >>"$H03_TEST_LOG"
exit 1
EOF
chmod +x "$bundle/scripts/production/safe-apply-migration.sh"
mkdir -p "$work/backups/daily/20261027T000000Z-daily"; : >"$work/backups/daily/20261027T000000Z-daily/postgres.dump"; echo "2026-10-27T00:00:00Z 20261027T000000Z-daily 2" >"$work/backups/last-success"
# The runner only trusts a marker written after it starts; put it in the future so the fixture is not second-boundary flaky.
touch -d "@$(( $(date +%s) + 600 ))" "$work/backups/last-success"
export BUNDLE_DIR="$bundle" THOIDAI_H03_APPLY_APPROVED=APPROVE-NOT-APPLIED-PRODUCTION-2026-10-27
if "$bundle/scripts/production/h03-production-apply.sh" --apply >"$state/apply.out" 2>&1; then echo 'expected postcondition failure' >&2; exit 1; fi
grep -Eq 'H03_FAIL=20261027120000_h03_corrective_partial_objects.sql' "$state/apply.out" || { cat "$state/apply.out"; exit 1; }
grep -Eq 'ROLLBACK_HINT=' "$state/apply.out" || { cat "$state/apply.out"; exit 1; }
echo TEST_PASS

main() {
  set -Eeuo pipefail
  local BD=/opt/ops/thoidai-work/h03-bundle-prod-20261027T063123Z E=$(ls -dt /opt/ops/thoidai-work/h03-evidence/prod-2*/ | head -1) T=$(mktemp -d)
  trap 'rm -rf "$T"' EXIT
  cat > $T/psql-wrapper <<'W'
#!/usr/bin/env bash
set -Eeuo pipefail
args=(); skip=0
for arg in "$@"; do
  if [[ $skip -eq 1 ]]; then skip=0; continue; fi
  case "$arg" in -h|--host|-p|--port|-U|--username|-d|--dbname) skip=1 ;; --host=*|--port=*|--username=*|--dbname=*) ;; *) args+=("$arg") ;; esac
done
exec docker exec -i supabase_db_thoidai-work psql -q -h 127.0.0.1 -U supabase_admin --dbname postgres "${args[@]}"
W
  chmod 700 $T/psql-wrapper
  export SAFE_MIGRATION_PSQL_BIN=$T/psql-wrapper SAFE_MIGRATION_MIGRATIONS_DIR=$BD/supabase/migrations H03_DB_URL=postgresql://supabase_admin@127.0.0.1:5432/postgres
  local S=$BD/scripts/production/safe-apply-migration.sh A=$BD/scripts/production/h03-apply M=$BD/supabase/migrations
  local f=20261027120100_h03_batch_idempotency_lockdown.sql sha
  sha=$(sha256sum $M/$f | awk '{print $1}')
  if $S --file $M/$f --db-url-env H03_DB_URL --reconcile-applied-version --expected-sha256 $sha --postcondition-sql $A/post/$f --evidence-dir $E >/dev/null; then printf 'STEP\t%s\tRECONCILED\n' $f; else echo "H03_FAIL=reconcile-$f"; return 1; fi
  local started=0 st
  while IFS= read -r f; do
    [[ -z $f ]] && continue
    [[ $f == $(sed -n 4p $A/order.txt) ]] && { started=1; continue; }
    ((started)) || continue
    st=$(date +%s)
    if $S --file $M/$f --db-url-env H03_DB_URL --postcondition-sql $A/post/$f --evidence-dir $E >/dev/null; then printf 'STEP\t%s\tPASS\t%s\n' $f $(($(date +%s)-st)); else printf 'STEP\t%s\tFAIL\n' $f; echo "H03_FAIL=$f"; return 1; fi
  done < $A/order.txt
  echo "LEDGER=$(docker exec -i supabase_db_thoidai-work psql -h 127.0.0.1 -U supabase_admin -d postgres -Atc 'select count(*) from supabase_migrations.schema_migrations' </dev/null)"
  { echo 'begin transaction read only;'; cat $BD/scripts/production/verify-anon-lockdown.sql; echo ';rollback;'; } | docker exec -i supabase_db_thoidai-work psql -h 127.0.0.1 -U supabase_admin -d postgres -qAt > $E/verify-after.txt
  cat $E/verify-after.txt | grep -E '_LEAK|RLS_OFF|MISSING|STORAGE'
  echo "HEALTH_LOCAL=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/login) HEALTH_PUBLIC=$(curl -s -o /dev/null -w '%{http_code}' https://thoidai.online/login) NRESTARTS=$(systemctl show thoidai-work -p NRestarts --value)"
  echo "JOURNAL_PERMISSION_OR_42501=$(journalctl -u thoidai-work --since '-20 min' 2>/dev/null | grep -Eic 'permission denied|42501' || true)"
  echo "H03_RESUME=DONE EVIDENCE=$E"
}
main "$@" </dev/null

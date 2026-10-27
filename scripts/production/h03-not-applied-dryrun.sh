#!/usr/bin/env bash

main() {
  set -Eeuo pipefail
  : "${BUNDLE_DIR:?BUNDLE_DIR is required}"
  command -v docker >/dev/null || { echo 'H03_ERROR=docker missing' >&2; return 1; }
  command -v node >/dev/null || { echo 'H03_ERROR=node missing; safe-apply-migration requires node on the host' >&2; return 1; }
  local evidence="/opt/ops/thoidai-work/h03-evidence/dryrun-$(date -u +%Y%m%dT%H%M%SZ)"
  local tmp="h03-dryrun-$$" work='' image='' port='' db_url='' backup='' dump='' manifest='' restore_log='' db_password=''
  mkdir -p "$evidence"
  cleanup() { local rc=$?; [[ -n "$tmp" ]] && docker rm -f -v "$tmp" >/dev/null 2>&1 || true; [[ -n "$work" && -d "$work" ]] && rm -rf -- "$work"; return "$rc"; }
  trap cleanup EXIT
  work=$(mktemp -d)
  image=$(docker ps --format '{{.Image}}' --filter name='^supabase_db_thoidai-work$' | head -n1)
  [[ -n "$image" ]] || { echo 'H03_ERROR=production database image not found' >&2; return 1; }
  local daily=/opt/ops/thoidai-work/backups/managed/daily
  while IFS= read -r entry; do [[ -f "$daily/$entry/postgres.dump" && -f "$daily/$entry/manifest.txt" ]] && { backup="$daily/$entry"; break; }; done < <(find "$daily" -mindepth 1 -maxdepth 1 -type d -name '*-daily' -printf '%f\n' | sort -r)
  [[ -n "$backup" ]] || { echo 'H03_ERROR=no complete daily backup' >&2; return 1; }
  dump="$backup/postgres.dump"; manifest="$backup/manifest.txt"; restore_log="$work/restore.log"
  local expected actual
  expected=$(awk '$2=="postgres.dump" || $2=="*postgres.dump" {print $1; exit}' "$manifest")
  actual=$(sha256sum "$dump" | awk '{print $1}')
  [[ "$expected" == "$actual" ]] || { echo 'H03_ERROR=backup hash mismatch' >&2; return 1; }
  db_password=$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')
  docker run -d --name "$tmp" --memory 512m -p 127.0.0.1::5432 -e POSTGRES_PASSWORD="$db_password" "$image" >/dev/null
  # Same readiness probe as backup-restore-drill.sh: server up and Supabase roles created.
  local ready=0 role_count
  for _ in $(seq 1 90); do
    if docker exec "$tmp" pg_isready -h 127.0.0.1 -U supabase_admin -d postgres >/dev/null 2>&1 \
      && role_count=$(docker exec -i "$tmp" psql -h 127.0.0.1 -U supabase_admin -d postgres -Atc "select count(*) from pg_roles where rolname in ('supabase_admin','supabase_auth_admin','supabase_storage_admin','service_role');" </dev/null) \
      && [[ "$role_count" == 4 ]]; then ready=1; break; fi
    sleep 2
  done
  ((ready)) || { echo 'H03_ERROR=disposable postgres timeout' >&2; return 1; }
  port=$(docker port "$tmp" 5432/tcp | sed -n 's/.*127.0.0.1:\([0-9]*\).*/\1/p' | head -n1)
  [[ "$port" =~ ^[0-9]+$ ]] || { echo 'H03_ERROR=disposable port missing' >&2; return 1; }
  docker exec -i "$tmp" psql -h 127.0.0.1 -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c 'create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations(version text primary key,name text not null,statements text[] not null); truncate supabase_migrations.schema_migrations;' >/dev/null
  docker exec -i "$tmp" pg_restore --schema=public --schema=supabase_migrations -h 127.0.0.1 -U supabase_admin -d postgres < "$dump" >"$restore_log" 2>&1 || true
  export H03_DB_URL="postgresql://supabase_admin:$db_password@127.0.0.1:$port/postgres"
  export SAFE_MIGRATION_MIGRATIONS_DIR="$BUNDLE_DIR/supabase/migrations"
  local pre="$work/pre.sql"
  cat > "$pre" <<'SQL'
do $$
declare v_count bigint;
begin
  select count(*) into v_count from supabase_migrations.schema_migrations;
  -- 133 = backups taken before the 2026-10-27 H-03 ledger backfill, 167 = after it.
  if v_count not in (133, 167) then raise exception 'expected ledger count 133 or 167, found %', v_count; end if;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in (
      'task_assignment_batch_idempotency','editorial_topics','editorial_series',
      'editorial_topic_tasks','editorial_series_items','journalism_publication_reports',
      'journalism_publication_verifications'
    )
  ) then raise exception 'target table or index already exists'; end if;
  if to_regprocedure('public.audit_direct_assignment_start()') is not null
     or to_regprocedure('public.api_assign_task_batch_v1(uuid,uuid,uuid,uuid,jsonb)') is not null
     or to_regprocedure('public.api_assert_journalism_access(uuid,uuid,text)') is not null
     or to_regprocedure('public.api_assert_journalism_department_scope(uuid,uuid)') is not null
     or to_regprocedure('public.api_register_journalism_task_v1(uuid,text,text,uuid,date,time,text,uuid,timestamptz,text,text)') is not null
  then raise exception 'target function already exists'; end if;
  if exists (
    select 1 from pg_trigger where not tgisinternal and tgname in (
      'journalism_work_kinds_set_updated_at','journalism_task_details_set_updated_at',
      'audit_direct_assignment_start','journalism_publication_reports_set_updated_at',
      'editorial_topic_tasks_journalism_task_guard','editorial_series_items_journalism_task_guard',
      'editorial_series_topic_compatibility_guard','editorial_topic_series_compatibility_guard',
      'editorial_topics_set_updated_at','editorial_series_set_updated_at','editorial_series_items_set_updated_at'
    )
  ) then raise exception 'target trigger already exists'; end if;
end $$;
select 1;
SQL
  psql "$H03_DB_URL" -v ON_ERROR_STOP=1 -f "$pre" >/dev/null
  local file start end rc result
  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    start=$(date +%s)
    set +e
    MIGRATION_EVIDENCE_DIR="$evidence" "$BUNDLE_DIR/scripts/production/safe-apply-migration.sh" --file "$BUNDLE_DIR/supabase/migrations/$file" --db-url-env H03_DB_URL --postcondition-sql "$BUNDLE_DIR/scripts/production/h03-apply/post/$file" --evidence-dir "$evidence"; rc=$?
    set -e
    end=$(date +%s); result=PASS; ((rc==0)) || result=FAIL
    printf 'STEP\t%s\t%s\t%s\n' "$file" "$result" "$((end-start))"
    ((rc==0)) || return "$rc"
  done < "$BUNDLE_DIR/scripts/production/h03-apply/order.txt"
  psql "$H03_DB_URL" -v ON_ERROR_STOP=1 -f "$BUNDLE_DIR/scripts/production/verify-anon-lockdown.sql" | tee "$evidence/anon-lockdown.txt"
  psql "$H03_DB_URL" -v ON_ERROR_STOP=1 -f "$BUNDLE_DIR/scripts/production/h03-apply/rollback.sql" >/dev/null
  psql "$H03_DB_URL" -v ON_ERROR_STOP=1 -f "$pre" >/dev/null
  echo 'H03_STATUS=PASS'
}

main "$@" </dev/null

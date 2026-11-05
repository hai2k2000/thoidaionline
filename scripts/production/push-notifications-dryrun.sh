#!/usr/bin/env bash
set +x
set -Eeuo pipefail
umask 077
# Restore a checked backup into a new disposable database; never accept a live URL.
: "${THOIDAI_PUSH_DRYRUN_APPROVED:?Set to 1 to approve the disposable rehearsal}"
[[ "$THOIDAI_PUSH_DRYRUN_APPROVED" == 1 ]]
: "${BUNDLE_DIR:?BUNDLE_DIR is required}"
: "${POSTGRES_IMAGE:?A locally available Supabase-compatible image is required}"
: "${PUSH_BACKUP_DUMP:?Verified custom-format backup path is required}"
: "${PUSH_BACKUP_SHA256:?Expected backup SHA-256 is required}"
: "${PUSH_EVIDENCE_DIR:?Private evidence directory outside releases is required}"
[[ "$PUSH_BACKUP_SHA256" =~ ^[0-9a-fA-F]{64}$ ]]
[[ "$(sha256sum "$PUSH_BACKUP_DUMP" | awk '{print $1}')" == "${PUSH_BACKUP_SHA256,,}" ]]
command -v docker >/dev/null
command -v psql >/dev/null
docker image inspect "$POSTGRES_IMAGE" >/dev/null 2>&1
source "$BUNDLE_DIR/scripts/production/disk-guard.sh"
docker_root=$(docker info --format '{{.DockerRootDir}}')
free_kb=$(df -Pk "$docker_root" | awk 'NR==2 {print $4}')
disk_guard_require "$free_kb" "$THOIDAI_DISK_DEFAULT_HEADROOM_KB" push-dryrun
mkdir -p "$PUSH_EVIDENCE_DIR"
container=''
step=init
cleanup() {
  rc=$?
  trap - EXIT
  [[ -z "$container" ]] || docker rm -f -v "$container" >/dev/null 2>&1 || rc=1
  if [[ "$rc" == 0 ]]; then echo 'PUSH_DRYRUN_RESULT=PASS'; else echo "PUSH_DRYRUN_RESULT=FAIL step=$step" >&2; fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
step=restore
candidate="push-notifications-dryrun-$$"
if docker container inspect "$candidate" >/dev/null 2>&1; then echo 'PUSH_DRYRUN_ERROR=container exists' >&2; exit 1; fi
password=$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')
container="$candidate"
POSTGRES_PASSWORD="$password" docker run --pull never -d --name "$container" --memory 1g \
  -p 127.0.0.1::5432 -e POSTGRES_PASSWORD "$POSTGRES_IMAGE" >/dev/null
ready=0
for _ in $(seq 1 60); do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U supabase_admin -d postgres >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[[ "$ready" == 1 ]]
docker exec -i "$container" psql -X -q -h 127.0.0.1 -U supabase_admin -d postgres \
  -v ON_ERROR_STOP=1 -c 'create schema if not exists supabase_migrations;' </dev/null >/dev/null
docker exec -i "$container" pg_restore --schema=public --schema=supabase_migrations \
  -h 127.0.0.1 -U supabase_admin -d postgres < "$PUSH_BACKUP_DUMP" >"$PUSH_EVIDENCE_DIR/restore.log" 2>&1 || true
port=$(docker port "$container" 5432/tcp | sed -n 's/^127.0.0.1:\([0-9]*\)$/\1/p')
[[ "$port" =~ ^[0-9]+$ ]]
export PGHOST=127.0.0.1 PGPORT="$port" PGUSER=supabase_admin PGDATABASE=postgres PGPASSWORD="$password"
psql_safe() { psql -X -v ON_ERROR_STOP=1 "$@"; }
if ! restore_counts=$(psql_safe -qAt -F'|' -c 'select (select count(*) from public.tasks), (select count(*) from public.staff_users), (select count(*) from public.task_assignees), (select count(*) from supabase_migrations.schema_migrations)' 2>/dev/null) \
  || ! [[ "$restore_counts" =~ ^[1-9][0-9]*\|[1-9][0-9]*\|[1-9][0-9]*\|[1-9][0-9]*$ ]]; then
  grep 'ERROR' "$PUSH_EVIDENCE_DIR/restore.log" >&2 || true
  echo 'PUSH_DRYRUN_ERROR=restore requires nonempty tasks, staff_users, task_assignees and schema_migrations' >&2
  exit 1
fi
printf 'PUSH_RESTORE_COUNTS=%s\n' "$restore_counts"

# Disposable restores may retain image default ACLs instead of C-01 lockdown.
step=restore_acl
psql_safe -q >"$PUSH_EVIDENCE_DIR/restore-acl.log" 2>&1 <<'SQL'
do $acl$
declare obj regclass; fn regprocedure;
begin
  for obj in select oid::regclass from pg_class
    where relnamespace='public'::regnamespace and relkind in ('r','p')
      and relname in ('mobile_push_tokens','notifications','push_subscriptions') loop
    execute format('revoke all on table %s from public,anon,authenticated',obj);
    execute format('grant all on table %s to service_role',obj);
  end loop;
  fn := to_regprocedure('public.claim_push_notifications(text[])');
  if fn is not null then
    execute format('revoke all on function %s from public,anon,authenticated',fn);
    execute format('grant execute on function %s to service_role',fn);
  end if;
end $acl$;
SQL
migration="$BUNDLE_DIR/supabase/migrations/20261107100000_push_notifications.sql"
sha256sum "$migration" >"$PUSH_EVIDENCE_DIR/migration.sha256"
counts() { psql_safe -qAt -c 'select (select count(*) from public.tasks), (select count(*) from public.task_assignees), (select count(*) from public.staff_users)'; }
before=$(counts)
step=apply
export PUSH_DRYRUN_DB_URL="postgresql://supabase_admin:$password@127.0.0.1:$port/postgres"
export SAFE_MIGRATION_MIGRATIONS_DIR="$BUNDLE_DIR/supabase/migrations"
post="$BUNDLE_DIR/scripts/production/push-notifications-post.sql"
bash "$BUNDLE_DIR/scripts/production/safe-apply-migration.sh" --file "$migration" \
  --db-url-env PUSH_DRYRUN_DB_URL --postcondition-sql "$post" --evidence-dir "$PUSH_EVIDENCE_DIR" \
  >"$PUSH_EVIDENCE_DIR/apply.log" 2>&1
[[ "$(psql_safe -qAt -f "$post")" == pass ]]
[[ "$(counts)" == "$before" ]]
step=behaviour
psql_safe -f "$BUNDLE_DIR/supabase/tests/push_notifications_behaviour.sql" >"$PUSH_EVIDENCE_DIR/behaviour.log" 2>&1
step=idempotency
queue_before=$(psql_safe -qAt -c 'select (select count(*) from public.notifications), (select count(*) from public.push_subscriptions)')
psql_safe -f "$migration" >"$PUSH_EVIDENCE_DIR/replay.log" 2>&1
[[ "$(counts)" == "$before" ]]
[[ "$(psql_safe -qAt -c 'select (select count(*) from public.notifications), (select count(*) from public.push_subscriptions)')" == "$queue_before" ]]
step=revert
psql_safe -f "$BUNDLE_DIR/scripts/production/push-notifications-revert.sql" >"$PUSH_EVIDENCE_DIR/revert.log" 2>&1
[[ "$(psql_safe -qAt -c "select count(*) from pg_trigger where tgname='trg_enqueue_task_assignment_notification'")" == 0 ]]
[[ "$(counts)" == "$before" ]]
psql_safe -f "$migration" >"$PUSH_EVIDENCE_DIR/reapply.log" 2>&1
psql_safe -f "$BUNDLE_DIR/supabase/tests/push_notifications_behaviour.sql" >"$PUSH_EVIDENCE_DIR/reapply-behaviour.log" 2>&1
printf 'PUSH_DRYRUN_CHECKS=PASS\n' >"$PUSH_EVIDENCE_DIR/result.txt"

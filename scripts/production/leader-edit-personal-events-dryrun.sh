#!/usr/bin/env bash
set +x
tmp=''
work=''
step=init

cleanup() {
  local rc=$?
  set +u
  set +e
  if [[ -n "$tmp" ]]; then
    docker rm -f -v "$tmp" >/dev/null 2>&1 || rc=1
  fi
  [[ -n "$work" ]] && rm -rf -- "$work"
  if [[ $rc -ne 0 ]]; then
    echo "LEADER_EDIT_PERSONAL_EVENTS_DRYRUN_RESULT=FAIL step=$step" >&2
  else
    echo "LEADER_EDIT_PERSONAL_EVENTS_DRYRUN_RESULT=PASS step=$step"
  fi
  trap - EXIT
  exit "$rc"
}

main() {
  set -Eeuo pipefail
  trap cleanup EXIT
  umask 077
  [[ "${THOIDAI_LEADER_EDIT_PERSONAL_EVENTS_DRYRUN_APPROVED:-0}" == 1 ]] || { echo 'LEADER_EDIT_PERSONAL_EVENTS_DRYRUN_ERROR=approval required' >&2; return 1; }
  : "${BUNDLE_DIR:?BUNDLE_DIR is required}"; : "${POSTGRES_IMAGE:?POSTGRES_IMAGE is required}"
  command -v docker >/dev/null; command -v node >/dev/null; command -v psql >/dev/null
  local evidence="/opt/ops/thoidai-work/leader-edit-personal-events-evidence/dryrun-$(date -u +%Y%m%dT%H%M%SZ)"
  local daily=/opt/ops/thoidai-work/backups/managed/daily
  local backup='' dump='' manifest='' db_password='' port='' candidate="leader-edit-personal-events-dryrun-$$"
  local migrations="$BUNDLE_DIR/supabase/migrations"
  local free_kb docker_root apply_out before after ready=0
  mkdir -p "$evidence"
  trap 'exit 130' INT
  trap 'exit 143' TERM
  step=disk
  source "$BUNDLE_DIR/scripts/production/disk-guard.sh"
  docker_root=$(docker info --format '{{.DockerRootDir}}')
  free_kb=$(df -Pk "$docker_root" | awk 'NR==2 {print $4}')
  disk_guard_require "$free_kb" "$THOIDAI_DISK_DEFAULT_HEADROOM_KB" leader-edit-personal-events-dryrun
  work=$(mktemp -d)

  # Latest verified daily backup: fail closed if its checksum does not match.
  step=backup
  while IFS= read -r entry; do
    [[ -f "$daily/$entry/postgres.dump" && -f "$daily/$entry/manifest.txt" ]] && { backup="$daily/$entry"; break; }
  done < <(find "$daily" -mindepth 1 -maxdepth 1 -type d -name '*-daily' -printf '%f\n' | sort -r)
  [[ -n "$backup" ]]
  dump="$backup/postgres.dump"; manifest="$backup/manifest.txt"
  [[ "$(awk '$2=="postgres.dump" || $2=="*postgres.dump" {print $1; exit}' "$manifest")" == "$(sha256sum "$dump" | awk '{print $1}')" ]]
  echo LEADER_EDIT_PERSONAL_EVENTS_BACKUP=PASS

  step=postgres
  local containers
  containers=$(docker ps -a --format '{{.Names}}')
  if grep -Eq '^leader-edit-personal-events-dryrun-[^[:space:]]+$' <<<"$containers"; then
    echo 'LEADER_EDIT_PERSONAL_EVENTS_DRYRUN_ERROR=leftover dry-run container exists' >&2; return 1
  fi
  db_password=$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')
  # Claim cleanup ownership only after the leftover check; never remove an old container.
  POSTGRES_PASSWORD="$db_password" docker run -d --name "$candidate" --memory 512m \
    -p 127.0.0.1::5432 -e POSTGRES_PASSWORD "$POSTGRES_IMAGE" >/dev/null 2>&1
  tmp="$candidate"
  for _ in $(seq 1 90); do
    if docker exec "$tmp" pg_isready -h 127.0.0.1 -U supabase_admin -d postgres >/dev/null 2>&1; then ready=1; break; fi
    sleep 2
  done
  [[ "$ready" == 1 ]]
  step=restore
  docker exec -i "$tmp" psql -q -h 127.0.0.1 -U supabase_admin -d postgres \
    -v ON_ERROR_STOP=1 -c 'create schema if not exists supabase_migrations;' </dev/null >/dev/null
  docker exec -i "$tmp" pg_restore --schema=public --schema=supabase_migrations -h 127.0.0.1 -U supabase_admin -d postgres \
    < "$dump" >"$work/restore.log" 2>&1 || true
  port=$(docker port "$tmp" 5432/tcp | sed -n 's/^127.0.0.1:\([0-9]*\)$/\1/p')
  [[ "$port" =~ ^[0-9]+$ ]]
  export LEADER_EDIT_PERSONAL_EVENTS_DB_URL="postgresql://supabase_admin:$db_password@127.0.0.1:$port/postgres"
  export SAFE_MIGRATION_MIGRATIONS_DIR="$BUNDLE_DIR/supabase/migrations"
  export PGHOST=127.0.0.1 PGPORT="$port" PGUSER=supabase_admin PGDATABASE=postgres PGPASSWORD="$db_password"
  local restore_counts
  if ! restore_counts=$(psql -X -v ON_ERROR_STOP=1 -qAt -F'|' -c "select (select count(*) from public.tasks), (select count(*) from public.staff_users), (select count(*) from public.departments), (select count(*) from supabase_migrations.schema_migrations)" 2>/dev/null) || ! [[ "$restore_counts" =~ ^[0-9]+\|[0-9]+\|[0-9]+\|[1-9][0-9]*$ ]]; then
    echo LEADER_EDIT_PERSONAL_EVENTS_RESTORE=FAIL >&2
    return 1
  fi
  echo "$restore_counts"
  echo LEADER_EDIT_PERSONAL_EVENTS_RESTORE=PASS

  # Restored dumps may omit function ACLs. Reassert the established service-only contract.
  step=restore_acl
  psql -X -v ON_ERROR_STOP=1 -q >"$work/acl.log" 2>&1 <<'SQL'
revoke all on function public.api_create_personal_work_schedule(uuid,uuid,date,date,text,time,time,text,text,text,uuid[],bigint) from public,anon,authenticated;
grant execute on function public.api_create_personal_work_schedule(uuid,uuid,date,date,text,time,time,text,text,text,uuid[],bigint) to service_role;
SQL
  step=postcondition_file
  local post="$work/post.sql"
  cat >"$post" <<'SQL'
select case when count(*) = 1 and bool_and(
  position('v_leader_edit' in p.prosrc)>0
  and position('truong_phong' in p.prosrc)>0
  and position('v_department=v_actor_department' in p.prosrc)>0
  and position('participant_ids=p_participant_ids' in p.prosrc)>0
  and position('cong_tac_vien' in p.prosrc)>0
  and p.prosecdef
  and p.proconfig = array['search_path=public, pg_temp']
  and pg_get_userbyid(p.proowner)='postgres'
  and has_function_privilege('service_role',p.oid,'EXECUTE')
  and not has_function_privilege('anon',p.oid,'EXECUTE')
  and not has_function_privilege('authenticated',p.oid,'EXECUTE')
  and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl where acl.grantee=0 and acl.privilege_type='EXECUTE')
) then 'pass' else 'fail' end
from pg_proc p where p.oid in (
  'public.api_create_personal_work_schedule(uuid,uuid,date,date,text,time,time,text,text,text,uuid[],bigint)'::regprocedure
);
SQL
  step=apply
  apply_out=$(MIGRATION_EVIDENCE_DIR="$evidence" "$BUNDLE_DIR/scripts/production/safe-apply-migration.sh" \
    --file "$migrations/20261106200000_leader_edit_personal_events.sql" \
    --db-url-env LEADER_EDIT_PERSONAL_EVENTS_DB_URL --postcondition-sql "$post" --evidence-dir "$evidence" 2>"$work/apply.log")
  grep -q '^PASS' <<<"$apply_out"
  step=postcondition
  [[ "$(psql -X -v ON_ERROR_STOP=1 -qAt -f "$post" 2>"$work/post.log")" == pass ]]
  [[ "$(psql -X -v ON_ERROR_STOP=1 -qAt -c "select count(*) from supabase_migrations.schema_migrations where version='20261106200000'" 2>"$work/ledger.log")" == 1 ]]
  step=idempotency
  before=$(psql -X -v ON_ERROR_STOP=1 -qAt -c "select (select count(*) from public.work_schedules), (select count(*) from public.work_schedule_event_assignments), (select count(*) from public.audit_logs)")
  psql -X -v ON_ERROR_STOP=1 -f "$migrations/20261106200000_leader_edit_personal_events.sql" >"$work/replay.log" 2>&1
  after=$(psql -X -v ON_ERROR_STOP=1 -qAt -c "select (select count(*) from public.work_schedules), (select count(*) from public.work_schedule_event_assignments), (select count(*) from public.audit_logs)")
  [[ "$before" == "$after" ]]
  [[ "$(psql -X -v ON_ERROR_STOP=1 -qAt -f "$post")" == pass ]]
  step=behaviour
  psql -X -v ON_ERROR_STOP=1 -f "$BUNDLE_DIR/supabase/tests/leader_edit_personal_events_behaviour.sql" >"$work/behaviour.log" 2>&1 || { tail -20 "$work/behaviour.log" >&2; return 1; }
  echo LEADER_EDIT_PERSONAL_EVENTS_BEHAVIOUR=PASS
  step=complete
  echo LEADER_EDIT_PERSONAL_EVENTS_DRYRUN_CHECKS=PASS >"$evidence/result.txt"
}
main "$@" </dev/null

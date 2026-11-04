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
    echo "PROJECTS_REOPEN_DRYRUN_RESULT=FAIL step=$step" >&2
  else
    echo PROJECTS_REOPEN_DRYRUN_RESULT=PASS
  fi
  trap - EXIT
  exit "$rc"
}

main() {
  set -Eeuo pipefail
  umask 077
  [[ "${THOIDAI_PROJECTS_REOPEN_DRYRUN_APPROVED:-0}" == 1 ]] || { echo 'PROJECTS_REOPEN_DRYRUN_ERROR=approval required' >&2; return 1; }
  : "${BUNDLE_DIR:?BUNDLE_DIR is required}"; : "${POSTGRES_IMAGE:?POSTGRES_IMAGE is required}"
  command -v docker >/dev/null; command -v node >/dev/null; command -v psql >/dev/null
  local evidence="/opt/ops/thoidai-work/projects-reopen-evidence/dryrun-$(date -u +%Y%m%dT%H%M%SZ)"
  local daily=/opt/ops/thoidai-work/backups/managed/daily
  local backup='' dump='' manifest='' db_password='' port='' candidate="projects-reopen-dryrun-$$"
  local migration="$BUNDLE_DIR/supabase/migrations/20261105100000_projects_reopen.sql"
  local post="$BUNDLE_DIR/scripts/production/projects-reopen/post/20261105100000_projects_reopen.sql"
  local free_kb docker_root apply_out before after ready=0
  mkdir -p "$evidence"
  trap cleanup EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  step=disk
  source "$BUNDLE_DIR/scripts/production/disk-guard.sh"
  docker_root=$(docker info --format '{{.DockerRootDir}}')
  free_kb=$(df -Pk "$docker_root" | awk 'NR==2 {print $4}')
  disk_guard_require "$free_kb" "$THOIDAI_DISK_DEFAULT_HEADROOM_KB" projects-dryrun
  work=$(mktemp -d)

  # Latest verified daily backup: fail closed if its checksum does not match.
  step=backup
  while IFS= read -r entry; do
    [[ -f "$daily/$entry/postgres.dump" && -f "$daily/$entry/manifest.txt" ]] && { backup="$daily/$entry"; break; }
  done < <(find "$daily" -mindepth 1 -maxdepth 1 -type d -name '*-daily' -printf '%f\n' | sort -r)
  [[ -n "$backup" ]]
  dump="$backup/postgres.dump"; manifest="$backup/manifest.txt"
  [[ "$(awk '$2=="postgres.dump" || $2=="*postgres.dump" {print $1; exit}' "$manifest")" == "$(sha256sum "$dump" | awk '{print $1}')" ]]
  echo PROJECTS_REOPEN_BACKUP=PASS

  step=postgres
  local containers
  containers=$(docker ps -a --format '{{.Names}}')
  if grep -Eq '^projects-reopen-dryrun-[^[:space:]]+$' <<<"$containers"; then
    echo 'PROJECTS_REOPEN_DRYRUN_ERROR=leftover dry-run container exists' >&2; return 1
  fi
  db_password=$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')
  # Claim cleanup ownership only after the leftover check; never remove an old container.
  tmp="$candidate"
  POSTGRES_PASSWORD="$db_password" docker run -d --name "$tmp" --memory 512m \
    -p 127.0.0.1::5432 -e POSTGRES_PASSWORD "$POSTGRES_IMAGE" >/dev/null 2>&1
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
  export PROJECTS_REOPEN_DB_URL="postgresql://supabase_admin:$db_password@127.0.0.1:$port/postgres"
  export SAFE_MIGRATION_MIGRATIONS_DIR="$BUNDLE_DIR/supabase/migrations"
  export PGHOST=127.0.0.1 PGPORT="$port" PGUSER=supabase_admin PGDATABASE=postgres PGPASSWORD="$db_password"
  local restore_counts
  if ! restore_counts=$(psql -X -v ON_ERROR_STOP=1 -qAt -F'|' -c "select (select count(*) from public.tasks), (select count(*) from public.staff_users), (select count(*) from public.departments), (select count(*) from supabase_migrations.schema_migrations)" 2>/dev/null) || ! [[ "$restore_counts" =~ ^[0-9]+\|[0-9]+\|[0-9]+\|[1-9][0-9]*$ ]]; then
    tail -n 20 "$work/restore.log" | grep 'ERROR' >&2 || true
    return 1
  fi
  echo "$restore_counts"
  echo PROJECTS_REOPEN_RESTORE=PASS

  # Restore may leave default grants on V1 and V1.1 objects; reassert their ACLs.
  step=restore_acl
  psql -X -v ON_ERROR_STOP=1 -q >"$work/restore-acl.log" 2>&1 <<'SQL'
revoke all on table public.projects,public.project_members from public,anon,authenticated;
grant all on table public.projects,public.project_members to service_role;
do $$ declare f text; begin foreach f in array array['enforce_assignee_manager_watcher()','review_task_completion(uuid,uuid,text,text)','api_project_actor_can_create(uuid)','api_project_is_lead(uuid,uuid)','api_assert_task_action(uuid,uuid,text)','api_create_project(uuid,text,text,text,uuid,uuid[])','api_update_project(uuid,uuid,text,text,text,uuid)','api_set_project_member(uuid,uuid,uuid,text,boolean)','api_close_project(uuid,uuid)','api_assign_project_task(uuid,uuid,text,text,uuid,uuid,date,time,text,uuid[],uuid[],text,text)'] loop execute format('revoke all on function public.%s from public,anon,authenticated',f); execute format('grant execute on function public.%s to service_role',f); execute format('alter function public.%s owner to postgres',f); end loop; end $$;
revoke all on table public.project_library_folders,public.project_library_items from public,anon,authenticated;
grant all on table public.project_library_folders,public.project_library_items to service_role;
do $$ declare f regprocedure; begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in ('api_project_can_assign','guard_project_staff_role','guard_project_lead_role','api_assert_project_library','ensure_project_task_folder','create_project_task_folder','api_list_project_library','api_create_project_library_folder','api_mutate_project_library_folder','api_add_project_library_item','api_mutate_project_library_item','api_get_project_library_file','file_project_task_attachment') loop
 execute format('revoke all on function %s from public,anon,authenticated',f);
 execute format('grant execute on function %s to service_role',f);
 execute format('alter function %s owner to postgres',f);
 end loop;
end $$;
SQL
  echo PROJECTS_REOPEN_RESTORE_ACL=REASSERTED

  apply_projects() {
    apply_out=$(MIGRATION_EVIDENCE_DIR="$evidence" "$BUNDLE_DIR/scripts/production/safe-apply-migration.sh" \
      --file "$migration" --db-url-env PROJECTS_REOPEN_DB_URL --postcondition-sql "$post" --evidence-dir "$evidence" 2>"$work/apply.log")
    grep -q '^PASS' <<<"$apply_out"
    [[ "$(psql -X -v ON_ERROR_STOP=1 -qAt -f "$post" 2>"$work/post.log")" == pass ]]
    [[ "$(psql -X -v ON_ERROR_STOP=1 -qAt -c "select count(*) from supabase_migrations.schema_migrations where version='20261105100000'" 2>"$work/ledger.log")" == 1 ]]
    echo "PROJECTS_REOPEN_STEP=$step STATUS=PASS"
  }
  step=apply; apply_projects
  step=behaviour
  if ! psql -X -v ON_ERROR_STOP=1 -f "$BUNDLE_DIR/supabase/tests/projects_reopen_behaviour.sql" >"$work/behaviour.log" 2>&1; then
    grep -E "ERROR|CONTEXT|DETAIL|HINT|LINE|psql:" "$work/behaviour.log" | head -20 | tee "$evidence/behaviour-error.txt" >&2 || true
    return 1
  fi
  echo PROJECTS_REOPEN_BEHAVIOUR=PASS >"$evidence/behaviour.txt"

  step=idempotency
  local counts="select (select count(*) from public.projects), (select count(*) from public.project_members), (select count(*) from public.audit_logs), (select count(*) from pg_proc where oid=to_regprocedure('public.api_reopen_project(uuid,uuid)')), md5(pg_get_functiondef('public.api_close_project(uuid,uuid)'::regprocedure))"
  before=$(psql -X -v ON_ERROR_STOP=1 -qAt -c "$counts" 2>"$work/counts.log")
  psql -X -v ON_ERROR_STOP=1 -f "$migration" >"$work/idempotency.log" 2>&1
  after=$(psql -X -v ON_ERROR_STOP=1 -qAt -c "$counts" 2>"$work/counts.log")
  [[ "$before" == "$after" ]]
  [[ "$(psql -X -v ON_ERROR_STOP=1 -qAt -f "$post" 2>"$work/post.log")" == pass ]]
  echo PROJECTS_REOPEN_IDEMPOTENCY=PASS

  step=revert
  psql -X -v ON_ERROR_STOP=1 -f "$BUNDLE_DIR/scripts/production/projects-reopen-revert.sql" >"$work/revert.log" 2>&1
  # The manual revert does not manage the ledger; remove only this disposable DB entry.
  psql -X -v ON_ERROR_STOP=1 -q -c "delete from supabase_migrations.schema_migrations where version='20261105100000'" >"$work/ledger.log" 2>&1
  [[ "$(psql -X -v ON_ERROR_STOP=1 -qAt 2>"$work/revert-check.log" <<'SQL'
select case when
  to_regprocedure('public.api_reopen_project(uuid,uuid)') is null and to_regclass('public.project_library_folders') is not null and to_regclass('public.project_library_items') is not null
  and to_regclass('public.projects') is not null and to_regclass('public.project_members') is not null
  and not exists(select 1 from supabase_migrations.schema_migrations where version='20261105100000')
then 'pass' else 'fail' end;
SQL
  )" == pass ]]
  echo PROJECTS_REOPEN_REVERT=PASS
  step=reapply; apply_projects
  step=complete
  echo PROJECTS_REOPEN_CHECKS=PASS >"$evidence/result.txt"
}
main "$@" </dev/null

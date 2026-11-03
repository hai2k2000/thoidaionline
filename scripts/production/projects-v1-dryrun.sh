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
    echo "PROJECTS_DRYRUN_RESULT=FAIL step=$step" >&2
  else
    echo PROJECTS_DRYRUN_RESULT=PASS
  fi
  trap - EXIT
  exit "$rc"
}

main() {
  set -Eeuo pipefail
  umask 077
  [[ "${THOIDAI_PROJECTS_DRYRUN_APPROVED:-0}" == 1 ]] || { echo 'PROJECTS_DRYRUN_ERROR=approval required' >&2; return 1; }
  : "${BUNDLE_DIR:?BUNDLE_DIR is required}"; : "${POSTGRES_IMAGE:?POSTGRES_IMAGE is required}"
  command -v docker >/dev/null; command -v node >/dev/null; command -v psql >/dev/null
  local evidence="/opt/ops/thoidai-work/projects-evidence/dryrun-$(date -u +%Y%m%dT%H%M%SZ)"
  local daily=/opt/ops/thoidai-work/backups/managed/daily
  local backup='' dump='' manifest='' db_password='' port='' candidate="projects-v1-dryrun-$$"
  local migration="$BUNDLE_DIR/supabase/migrations/20261103160000_projects_v1.sql"
  local post="$BUNDLE_DIR/scripts/production/projects-v1/post/20261103160000_projects_v1.sql"
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
  echo PROJECTS_BACKUP=PASS

  step=postgres
  local containers
  containers=$(docker ps -a --format '{{.Names}}')
  if grep -Eq '^projects-v1-dryrun-[^[:space:]]+$' <<<"$containers"; then
    echo 'PROJECTS_DRYRUN_ERROR=leftover dry-run container exists' >&2; return 1
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
  docker exec -i "$tmp" pg_restore --clean --if-exists --exit-on-error \
    --schema=public --schema=supabase_migrations -h 127.0.0.1 -U supabase_admin -d postgres \
    < "$dump" >"$work/restore.log" 2>&1
  port=$(docker port "$tmp" 5432/tcp | sed -n 's/^127.0.0.1:\([0-9]*\)$/\1/p')
  [[ "$port" =~ ^[0-9]+$ ]]
  export PROJECTS_DB_URL="postgresql://supabase_admin:$db_password@127.0.0.1:$port/postgres"
  export SAFE_MIGRATION_MIGRATIONS_DIR="$BUNDLE_DIR/supabase/migrations"
  export PGHOST=127.0.0.1 PGPORT="$port" PGUSER=supabase_admin PGDATABASE=postgres PGPASSWORD="$db_password"
  echo PROJECTS_RESTORE=PASS

  apply_projects() {
    apply_out=$(MIGRATION_EVIDENCE_DIR="$evidence" "$BUNDLE_DIR/scripts/production/safe-apply-migration.sh" \
      --file "$migration" --db-url-env PROJECTS_DB_URL --postcondition-sql "$post" --evidence-dir "$evidence" 2>"$work/apply.log")
    grep -q '^PASS' <<<"$apply_out"
    [[ "$(psql -X -v ON_ERROR_STOP=1 -qAt -f "$post" 2>"$work/post.log")" == pass ]]
    [[ "$(psql -X -v ON_ERROR_STOP=1 -qAt -c "select count(*) from supabase_migrations.schema_migrations where version='20261103160000'" 2>"$work/ledger.log")" == 1 ]]
    echo "PROJECTS_STEP=$step STATUS=PASS"
  }
  step=apply; apply_projects
  step=behaviour
  psql -X -v ON_ERROR_STOP=1 -f "$BUNDLE_DIR/supabase/tests/projects_v1_behaviour.sql" >"$work/behaviour.log" 2>&1
  echo PROJECTS_BEHAVIOUR=PASS >"$evidence/behaviour.txt"

  step=idempotency
  local counts="select (select count(*) from public.permissions where code='project.create'), (select count(*) from public.role_permission_grants g join public.permissions p on p.id=g.permission_id where p.code='project.create'), (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname in ('api_create_project','api_update_project','api_set_project_member','api_close_project','api_assign_project_task','api_project_actor_can_create','api_project_is_lead'))"
  before=$(psql -X -v ON_ERROR_STOP=1 -qAt -c "$counts" 2>"$work/counts.log")
  psql -X -v ON_ERROR_STOP=1 -f "$migration" >"$work/idempotency.log" 2>&1
  after=$(psql -X -v ON_ERROR_STOP=1 -qAt -c "$counts" 2>"$work/counts.log")
  [[ "$before" == "$after" ]]
  [[ "$(psql -X -v ON_ERROR_STOP=1 -qAt -f "$post" 2>"$work/post.log")" == pass ]]
  echo PROJECTS_IDEMPOTENCY=PASS

  step=revert
  psql -X -v ON_ERROR_STOP=1 -f "$BUNDLE_DIR/scripts/production/projects-v1-revert.sql" >"$work/revert.log" 2>&1
  # The manual revert does not manage the ledger; remove only this disposable DB entry.
  psql -X -v ON_ERROR_STOP=1 -q -c "delete from supabase_migrations.schema_migrations where version='20261103160000'" >"$work/ledger.log" 2>&1
  [[ "$(psql -X -v ON_ERROR_STOP=1 -qAt 2>"$work/revert-check.log" <<'SQL'
select case when
  to_regclass('public.projects') is null and to_regclass('public.project_members') is null
  and not exists(select 1 from information_schema.columns where table_schema='public' and table_name='tasks' and column_name='project_id')
  and not exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname in ('api_create_project','api_update_project','api_set_project_member','api_close_project','api_assign_project_task','api_project_actor_can_create','api_project_is_lead'))
  and not exists(select 1 from public.permissions where code='project.create')
  and not exists(select 1 from supabase_migrations.schema_migrations where version='20261103160000')
then 'pass' else 'fail' end;
SQL
  )" == pass ]]
  echo PROJECTS_REVERT=PASS
  step=reapply; apply_projects
  step=complete
  echo PROJECTS_CHECKS=PASS >"$evidence/result.txt"
}
main "$@" </dev/null

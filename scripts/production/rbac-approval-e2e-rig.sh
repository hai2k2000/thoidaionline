#!/usr/bin/env bash

tmp=''
work=''
step=init

main() {
  set -Eeuo pipefail
  local command=${1:-status}
  local bundle=${BUNDLE_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}
  local network=rbac-e2e-net db=rbac-e2e-db rest=rbac-e2e-rest
  local daily=/opt/ops/thoidai-work/backups/managed/daily image rest_image db_password backup dump manifest rest_port
  cleanup() { local rc=$?; set +e; [[ -n "$work" ]] && rm -rf -- "$work"; return "$rc"; }
  trap cleanup EXIT
  case "$command" in
    status)
      docker ps -a --filter name='^rbac-e2e-' --format '{{.Names}} {{.Status}} {{.Ports}}'
      return 0
      ;;
    down)
      docker rm -f -v "$rest" "$db" >/dev/null 2>&1 || true
      docker network rm "$network" >/dev/null 2>&1 || true
      echo 'RBAC_E2E_DOWN=PASS'
      return 0
      ;;
    up) ;;
    *) echo 'usage: rbac-approval-e2e-rig.sh up|down|status' >&2; return 2 ;;
  esac
  [[ "${THOIDAI_RBAC_E2E_APPROVED:-0}" == 1 ]] || { echo 'RBAC_E2E_ERROR=approval required' >&2; return 1; }
  : "${RBAC_E2E_PASSWORD:?RBAC_E2E_PASSWORD is required}"; : "${RBAC_E2E_JWT_SECRET:?RBAC_E2E_JWT_SECRET is required}"
  [[ ${#RBAC_E2E_JWT_SECRET} -ge 32 ]] || { echo 'RBAC_E2E_ERROR=jwt secret too short' >&2; return 1; }
  command -v docker >/dev/null; command -v sha256sum >/dev/null
  "$bundle/scripts/production/disk-guard.sh"
  if docker ps -a --format '{{.Names}}' | grep -Eq '^rbac-e2e-[^[:space:]]+$'; then echo 'RBAC_E2E_ERROR=leftover container exists' >&2; return 1; fi
  work=$(mktemp -d)
  for entry in $(find "$daily" -mindepth 1 -maxdepth 1 -type d -name '*-daily' -printf '%f\n' | sort -r); do
    if [[ -f "$daily/$entry/postgres.dump" && -f "$daily/$entry/manifest.txt" ]]; then backup="$daily/$entry"; break; fi
  done
  [[ -n "${backup:-}" ]] || { echo 'RBAC_E2E_ERROR=no complete daily backup' >&2; return 1; }
  dump="$backup/postgres.dump"; manifest="$backup/manifest.txt"
  [[ "$(awk '$2=="postgres.dump" || $2=="*postgres.dump" {print $1; exit}' "$manifest")" == "$(sha256sum "$dump" | awk '{print $1}')" ]] || { echo 'RBAC_E2E_ERROR=backup hash mismatch' >&2; return 1; }
  image=${POSTGRES_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.095}
  rest_image=$(docker ps --format '{{.Image}}' --filter name='^supabase_rest_thoidai-work$' | head -n1)
  [[ -n "$rest_image" ]] || { echo 'RBAC_E2E_ERROR=production PostgREST image not found' >&2; return 1; }
  db_password=$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')
  docker network create "$network" >/dev/null
  docker run -d --name "$db" --network "$network" --memory 512m -e POSTGRES_PASSWORD="$db_password" "$image" >/dev/null
  for _ in $(seq 1 90); do docker exec "$db" pg_isready -h 127.0.0.1 -U supabase_admin -d postgres >/dev/null 2>&1 && break; sleep 2; done
  docker exec -i "$db" psql -h 127.0.0.1 -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <<SQL >/dev/null
alter default privileges for role postgres in schema public revoke all on tables from postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on functions from postgres, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public revoke all on tables from postgres, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public revoke all on sequences from postgres, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public revoke all on functions from postgres, anon, authenticated, service_role;
alter role supabase_admin password '$db_password';
SQL
  docker exec -i "$db" pg_restore --schema=public --schema=supabase_migrations -h 127.0.0.1 -U supabase_admin -d postgres < "$dump" >"$work/restore.log" 2>&1 || true
  docker exec -i "$db" psql -h 127.0.0.1 -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -f - < "$bundle/supabase/migrations/20261028100000_rbac_approval_permissions_v1.sql"
  docker exec -i "$db" psql -h 127.0.0.1 -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -v e2e_password="$RBAC_E2E_PASSWORD" -f - < "$bundle/supabase/tests/rbac_approval_v1_e2e_seed.sql"
  # The restored image's admin role is the only known TCP credential; use it rather than guessing an authenticator password.
  docker run -d --name "$rest" --network "$network" --memory 512m -p "127.0.0.1:${RBAC_E2E_REST_PORT:-55432}:3000" \
    -e PGRST_DB_URI="postgres://supabase_admin:${db_password}@${db}:5432/postgres" \
    -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$RBAC_E2E_JWT_SECRET" "$rest_image" >/dev/null
  rest_port=${RBAC_E2E_REST_PORT:-55432}
  echo "RBAC_E2E_UP rest_port=$rest_port"
}

main "$@" </dev/null

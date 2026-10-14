#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "$(uname -s)" != Linux ]]; then
  echo "rbac-readiness-integration: SKIP (requires Linux Docker and PostgreSQL 17)"
  exit 0
fi
if [[ "$(id -u)" -ne 0 ]]; then
  exec sudo --preserve-env=PATH bash "$0"
fi

root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd -P)
tmp=$(mktemp -d)
source_container="rbac-readiness-source-$$"
cleanup() { docker rm -f "$source_container" >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap cleanup EXIT

docker run -d --name "$source_container" -e POSTGRES_PASSWORD=producer-only -e POSTGRES_DB=producer postgres:17.6 >/dev/null
for _ in $(seq 1 90); do docker exec "$source_container" pg_isready -U postgres -d producer >/dev/null 2>&1 && break; sleep 1; done
docker exec "$source_container" pg_isready -U postgres -d producer >/dev/null
docker exec -i "$source_container" psql -v ON_ERROR_STOP=1 -U postgres -d producer <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema supabase_migrations;
create table supabase_migrations.schema_migrations(version text primary key, name text not null);
insert into supabase_migrations.schema_migrations(version,name) values
 ('20261015100000','20261015100000_rbac_v2_role_user_overrides.sql'),
 ('20261015110000','20261015110000_rbac_v2_scope_ambiguity_fix.sql'),
 ('20261015120000','20261015120000_quick_report_rpc_payload_compatibility.sql');
create table staff_users(id uuid primary key, active boolean not null default true);
create table roles(id uuid primary key, active boolean not null default true);
create table permissions(id uuid primary key, code text not null unique);
create table user_permission_grants(user_id uuid, permission_id uuid, effect text not null, constraint user_permission_grants_effect_check check (effect in ('allow','deny')));
insert into staff_users values ('30000000-0000-4000-8000-000000000001', true);
insert into roles values ('20000000-0000-4000-8000-000000000001', true);
insert into permissions values ('40000000-0000-4000-8000-000000000001', 'permission.manage');
create function api_list_effective_permissions(uuid)
returns table(permission_code text, permission_name text, module text, description text, role_scopes text[], user_effect text, user_scope text, effective_scopes text[], source text, actor_active boolean, role_active boolean)
language sql security definer set search_path=public,pg_temp
as $$ select 'permission.manage','Manage','permission',null,ARRAY['all']::text[],null,null,ARRAY['all']::text[],'role',true,true $$;
create function api_list_role_permission_grants(uuid) returns table(permission_code text, scope text) language sql security definer as $$ select 'permission.manage','all' $$;
create function api_create_quick_report_v1(uuid,uuid,jsonb) returns jsonb language sql security definer as $$ select '{}'::jsonb $$;
create function api_replace_role_permissions(uuid,uuid,jsonb) returns jsonb language sql security definer as $$ select '{}'::jsonb $$;
create function api_set_user_permission_override(uuid,uuid,text,text,text) returns jsonb language sql security definer as $$ select '{}'::jsonb $$;
create function api_restore_user_permission_inheritance(uuid,uuid) returns jsonb language sql security definer as $$ select '{}'::jsonb $$;
create function api_clear_user_permission_override(uuid,uuid,text) returns jsonb language sql security definer as $$ select '{}'::jsonb $$;
create function rbac_v2_assert_manager_survives() returns void language plpgsql security definer as $$ begin if not exists (select 1 from staff_users where active) then raise exception 'Cannot remove the last permission manager'; end if; end $$;
do $$ declare signature text; begin foreach signature in array array[
 'api_list_effective_permissions(uuid)','api_list_role_permission_grants(uuid)','api_create_quick_report_v1(uuid,uuid,jsonb)',
 'api_replace_role_permissions(uuid,uuid,jsonb)','api_set_user_permission_override(uuid,uuid,text,text,text)',
 'api_restore_user_permission_inheritance(uuid,uuid)','api_clear_user_permission_override(uuid,uuid,text)'] loop
   execute format('alter function public.%s owner to postgres', signature);
   execute format('revoke all on function public.%s from public, anon, authenticated', signature);
   execute format('grant execute on function public.%s to service_role', signature);
 end loop; end $$;
alter function public.rbac_v2_assert_manager_survives() owner to postgres;
SQL

backup="$tmp/production.dump"
docker exec "$source_container" pg_dump -U postgres -d producer -Fc --schema=public --schema=supabase_migrations > "$backup"
chmod 600 "$backup"
backup_sha=$(sha256sum "$backup" | awk '{print $1}')
printf 'backup_sha256=%s\n' "$backup_sha" > "$tmp/backup-meta.txt"
chmod 600 "$tmp/backup-meta.txt"
sha_migration_1=$(sha256sum "$root/supabase/migrations/20261015100000_rbac_v2_role_user_overrides.sql" | awk '{print $1}')
sha_migration_2=$(sha256sum "$root/supabase/migrations/20261015110000_rbac_v2_scope_ambiguity_fix.sql" | awk '{print $1}')
sha_migration_3=$(sha256sum "$root/supabase/migrations/20261015120000_quick_report_rpc_payload_compatibility.sql" | awk '{print $1}')
cat > "$tmp/migration-checksums.txt" <<EOF
canonical_sha=1cc9d346ef49235b9365132a22469ce9a15a5ab1
20261015100000_rbac_v2_role_user_overrides.sql $sha_migration_1
20261015110000_rbac_v2_scope_ambiguity_fix.sql $sha_migration_2
20261015120000_quick_report_rpc_payload_compatibility.sql $sha_migration_3
EOF
chmod 600 "$tmp/migration-checksums.txt"
cat > "$tmp/psql-wrapper" <<EOF
#!/usr/bin/env bash
args=()
skip=0
for arg in "\$@"; do
  if [[ "\$skip" == 1 ]]; then skip=0; continue; fi
  if [[ "\$arg" == --dbname ]]; then skip=1; continue; fi
  args+=("\$arg")
done
exec docker exec "$source_container" psql -U postgres -d producer "\${args[@]}"
EOF
chmod 700 "$tmp/psql-wrapper"
runner="$tmp/restore-runner"
cp "$root/scripts/production/verify-rbac-disposable-restore.sh" "$runner"
chmod 700 "$runner"
chown root:root "$backup" "$tmp/backup-meta.txt" "$tmp/migration-checksums.txt" "$tmp/psql-wrapper" "$runner"

output="$tmp/evidence"
mkdir "$output"
THOIDAI_RBAC_DB_URL=postgresql://unused \
THOIDAI_RBAC_PSQL_BIN="$tmp/psql-wrapper" \
THOIDAI_RBAC_DISPOSABLE_RESTORE_RUNNER="$runner" \
THOIDAI_RBAC_RESTORE_IMAGE=postgres:17.6 \
node "$root/scripts/production/produce-rbac-readiness.mjs" 1cc9d346ef49235b9365132a22469ce9a15a5ab1 "$backup" "$tmp/migration-checksums.txt" "$output" >/dev/null
test -s "$output/readiness.json"

cat > "$tmp/no-op-restore" <<'EOF'
#!/usr/bin/env bash
printf '{"status":"PASS"}\n'
EOF
chmod 700 "$tmp/no-op-restore"
if THOIDAI_RBAC_DB_URL=postgresql://unused THOIDAI_RBAC_PSQL_BIN="$tmp/psql-wrapper" THOIDAI_RBAC_DISPOSABLE_RESTORE_RUNNER="$tmp/no-op-restore" node "$root/scripts/production/produce-rbac-readiness.mjs" 1cc9d346ef49235b9365132a22469ce9a15a5ab1 "$backup" "$tmp/migration-checksums.txt" "$tmp/no-op-output" >/dev/null 2>&1; then
  echo "no-op restore was accepted" >&2
  exit 1
fi

docker exec "$source_container" psql -U postgres -d producer -v ON_ERROR_STOP=1 -c 'drop function public.api_clear_user_permission_override(uuid,uuid,text)' >/dev/null
if THOIDAI_RBAC_DB_URL=postgresql://unused THOIDAI_RBAC_PSQL_BIN="$tmp/psql-wrapper" THOIDAI_RBAC_DISPOSABLE_RESTORE_RUNNER="$runner" node "$root/scripts/production/produce-rbac-readiness.mjs" 1cc9d346ef49235b9365132a22469ce9a15a5ab1 "$backup" "$tmp/migration-checksums.txt" "$tmp/missing-rpc-output" >/dev/null 2>&1; then
  echo "missing protected RPC was accepted" >&2
  exit 1
fi
echo "rbac-readiness-integration: PASS (restore, no-op rejection, missing-RPC rejection)"

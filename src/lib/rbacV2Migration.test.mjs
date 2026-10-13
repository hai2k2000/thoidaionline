import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../../supabase/migrations/20261015100000_rbac_v2_role_user_overrides.sql", import.meta.url);
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

test("RBAC v2 migration adds an additive explicit effect without seeding grants", () => {
  assert.match(migration, /alter table public\.user_permission_grants/i);
  assert.match(migration, /add column if not exists effect text not null default 'allow'/i);
  assert.match(migration, /effect in \('allow', 'deny'\)/i);
  assert.match(migration, /api_list_effective_permissions/i);
  const schemaPreamble = migration.split(/create or replace function/i, 1)[0];
  assert.doesNotMatch(schemaPreamble, /insert into public\.(role_permission_grants|user_permission_grants)/i);
});
test("RBAC v2 migration exposes general role and user mutation RPCs", () => {
  assert.match(migration, /public\.api_replace_role_permissions\s*\(\s*p_actor_id uuid,\s*p_role_id uuid,\s*p_grants jsonb\s*\)/i);
  assert.match(migration, /public\.api_set_user_permission_override\s*\(\s*p_actor_id uuid,\s*p_user_id uuid,\s*p_permission_code text,\s*p_effect text,\s*p_scope text\s*\)/i);
  assert.match(migration, /public\.api_restore_user_permission_inheritance\s*\(\s*p_actor_id uuid,\s*p_user_id uuid\s*\)/i);
  assert.match(migration, /public\.audit_logs/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /revoke all on function/i);
  assert.match(migration, /grant execute on function .* to service_role/i);
});

test("RBAC v2 mutation RPCs fail closed around authority and last-manager safety", () => {
  assert.match(migration, /permission\.manage/i);
  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(migration, /self[-_ ]elevat|self.*role|own role/i);
  assert.match(migration, /last.*manager|manager.*last|count\(\*\).*permission\.manage/i);
  assert.match(migration, /for update/i);
  assert.match(migration, /inactive.*role|role_active\s*=\s*true/i);
  assert.match(migration, /rollback[\s\S]*compatib/i);
  assert.match(migration, /legacy[\s\S]*deny|deny[\s\S]*legacy/i);
});

test("RBAC v2 exposes targeted inheritance restore without deleting unrelated overrides", () => {
  assert.match(migration, /public\.api_clear_user_permission_override\s*\(\s*p_actor_id uuid,\s*p_user_id uuid,\s*p_permission_code text\s*\)/i);
  assert.match(migration, /delete from public\.user_permission_grants[\s\S]*permission_id/i);
});

test("RBAC v2 validates permission-specific scopes in database mutations", () => {
  assert.match(migration, /rbac_v2_scope_supported/i);
  assert.match(migration, /not public\.rbac_v2_scope_supported\(v_code,\s*s\)/i);
  assert.match(migration, /not public\.rbac_v2_scope_supported\(p_permission_code,\s*p_scope\)/i);
});

test("RBAC v2 mutation RPCs return effective-permission summaries", () => {
  assert.match(migration, /effectivePermissions|effective_permissions|effectiveSummary/i);
  assert.match(migration, /api_list_effective_permissions\(p_actor_id\)/i);
});

test("RBAC v2 resolver distinguishes direct allow from inactive role and deny precedence", () => {
  assert.match(migration, /user_effect|effect/i);
  assert.match(migration, /user_allow|user_deny/i);
  assert.match(migration, /u\.active = true/i);
  assert.match(migration, /role_active\s*=\s*true/i);
  assert.match(migration, /effective_scopes/i);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = "supabase/migrations/20260916100000_phase1a_rbac_core.sql";

test("RBAC core migration defines additive tables, lowercase scopes, and browser-deny ACL", () => {
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(sql, /create table if not exists public\.permissions/i);
  assert.match(sql, /create table if not exists public\.role_permission_grants/i);
  assert.match(sql, /code\s+text[^;]*unique/i);
  assert.match(sql, /check\s*\(scope\s+in\s*\(\s*'self'\s*,\s*'assigned'\s*,\s*'department'\s*,\s*'all'\s*\)\)/i);
  assert.match(sql, /alter table public\.permissions enable row level security/i);
  assert.match(sql, /alter table public\.role_permission_grants enable row level security/i);
  assert.match(sql, /revoke all on table public\.permissions from public, anon, authenticated/i);
  assert.match(sql, /revoke all on table public\.role_permission_grants from public, anon, authenticated/i);
  assert.doesNotMatch(sql, /drop table[^;]*role_permissions/i);
});

test("RBAC core migration seeds only compatibility permissions and grants", () => {
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(sql, /task\.view/);
  assert.match(sql, /task\.create/);
  assert.match(sql, /task\.assign/);
  assert.match(sql, /staff\.manage/);
  assert.match(sql, /permission\.manage/);
  assert.match(sql, /on conflict\s*\(code\)\s*do update/i);
  assert.match(sql, /on conflict\s*\(role_id, permission_id, scope\)\s*do nothing/i);
});

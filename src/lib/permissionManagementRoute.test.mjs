import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/permissions/route.ts", import.meta.url), "utf8");

test("permission management route authenticates reads and writes server-side", () => {
  assert.match(route, /requireReadActor/);
  assert.match(route, /requireMutationActor/);
  assert.match(route, /loadRbacActor/);
  assert.match(route, /permission\.manage/);
  assert.match(route, /rpcFailure/);
});

test("permission management route dispatches targeted inherit, restore-all, role, and override actions", () => {
  assert.match(route, /replace_role_permissions/);
  assert.match(route, /set_user_override/);
  assert.match(route, /clear_user_override/);
  assert.match(route, /restore_user_inheritance/);
  assert.match(route, /supportedScopesForPermission/);
  assert.match(route, /asUuid/);
});

test("legacy permission mutation remains a narrow compatibility path", () => {
  assert.match(route, /task\.quick_report\.create/);
  assert.match(route, /asset\.manage/);
  assert.doesNotMatch(route, /role_code\s*===\s*["']admin["']/);
});

test("permission catalog uses the unambiguous staff department relationship", () => {
  assert.match(route, /departments!staff_users_department_id_fkey\(name\)/);
  assert.doesNotMatch(route, /select\([^\n]*departments\(name\)/);
});

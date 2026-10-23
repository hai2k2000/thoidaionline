import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isCatalogPermission, supportedScopesForPermission } from "./rbac/permissionCatalog.ts";

const auth = readFileSync(new URL("./auth.tsx", import.meta.url), "utf8");
const session = readFileSync(new URL("./serverSession.ts", import.meta.url), "utf8");
const repository = readFileSync(new URL("./rbac/repository.ts", import.meta.url), "utf8");

test("catalog codes are authoritative and expose shared scope metadata", () => {
  assert.equal(isCatalogPermission("asset.manage"), true);
  assert.equal(isCatalogPermission("can_manage_permissions"), false);
  assert.deepEqual(supportedScopesForPermission("task.view"), ["self", "assigned", "department", "all"]);
  assert.deepEqual(supportedScopesForPermission("task.quick_report.create"), ["self", "all"]);
  assert.deepEqual(supportedScopesForPermission("record.self_approve"), ["self", "all"]);
  assert.deepEqual(supportedScopesForPermission("task.create"), ["all"]);
});

test("server and client consume the canonical effective resolver", () => {
  assert.match(repository, /api_list_effective_permissions/);
  assert.match(session, /rbacPermissions/);
  assert.match(auth, /isCatalogPermission/);
  assert.match(auth, /mapped catalog|catalog.*authoritative|isCatalogPermission/si);
});

test("inactive roles do not repopulate legacy fallback permissions", () => {
  assert.match(session, /role.*active|active.*role/si);
  assert.match(auth, /isCatalogPermission\(key\)/);
});

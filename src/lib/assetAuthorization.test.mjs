import assert from "node:assert/strict";
import test from "node:test";
import { canManageAssets, canViewAsset } from "./assetAuthorization.ts";

const assignment = (overrides = {}) => ({
  departmentId: "dept-a",
  assigneeId: null,
  ...overrides,
});

test("employee sees own assigned asset and department-common asset", () => {
  const actor = { id: "user-a", departmentId: "dept-a", isDepartmentManager: false, rbacPermissions: ["asset.view"] };
  assert.equal(canViewAsset(actor, assignment({ assigneeId: "user-a" })), true);
  assert.equal(canViewAsset(actor, assignment()), true);
});

test("employee cannot see coworker-owned asset", () => {
  const actor = { id: "user-a", departmentId: "dept-a", isDepartmentManager: false, rbacPermissions: ["asset.view"] };
  assert.equal(canViewAsset(actor, assignment({ assigneeId: "user-b" })), false);
});

test("department manager sees every current asset in own department only", () => {
  const actor = { id: "manager-a", departmentId: "dept-a", isDepartmentManager: true, rbacPermissions: ["asset.view"] };
  assert.equal(canViewAsset(actor, assignment({ assigneeId: "user-b" })), true);
  assert.equal(canViewAsset(actor, assignment({ departmentId: "dept-b" })), false);
});

test("asset.manage grants organization-wide access and is not task permission", () => {
  const actor = { id: "admin", departmentId: null, isDepartmentManager: false, rbacPermissions: ["asset.manage"] };
  assert.equal(canManageAssets(actor), true);
  assert.equal(canViewAsset(actor, assignment({ departmentId: "dept-z", assigneeId: "user-z" })), true);
  assert.equal(canManageAssets({ ...actor, rbacPermissions: ["can_edit_all_tasks"] }), false);
});

test("missing department never expands employee or manager scope", () => {
  const actor = { id: "user-a", departmentId: null, isDepartmentManager: true, rbacPermissions: ["asset.view"] };
  assert.equal(canViewAsset(actor, assignment({ departmentId: null })), false);
});

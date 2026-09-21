import assert from "node:assert/strict";
import test from "node:test";

import { can, scopesFor, hasPermission } from "./rbac/authorization.ts";
import { compareShadowResult } from "./rbac/shadow.ts";

const grants = [
  { permissionCode: "task.view", scope: "assigned" },
  { permissionCode: "task.view", scope: "department" },
  { permissionCode: "task.create", scope: "all" },
  { permissionCode: "task.assign", scope: "department" },
];
const actor = { id: "employee", departmentId: "dep-a", grants };
const task = {
  kind: "task",
  id: "task-1",
  departmentId: "dep-a",
  createdBy: "creator",
  ownerId: "employee",
  assigneeId: "employee",
  reviewerId: "reviewer",
  participantIds: [],
};

test("RBAC scopes resolve without turning task.create into assignment", () => {
  assert.deepEqual(scopesFor(actor, "task.view").sort(), ["assigned", "department"]);
  assert.equal(hasPermission(actor, "task.create"), true);
  assert.equal(can(actor, "task.create"), true);
  assert.equal(can(actor, "task.assign", { ...task, departmentId: "dep-b" }), false);
});

test("task scope checks use canonical resource relationships", () => {
  assert.equal(can(actor, "task.view", task), true);
  assert.equal(can(actor, "task.view", { ...task, departmentId: "dep-b", ownerId: "other", assigneeId: "other" }), false);
  assert.equal(can({ ...actor, grants: [{ permissionCode: "task.view", scope: "self" }] }, "task.view", { ...task, ownerId: "employee", assigneeId: "other" }), true);
});

test("shadow comparison classifies security and restrictive mismatches", () => {
  assert.equal(compareShadowResult({ legacy: true, rbac: true }).classification, "MATCH");
  assert.equal(compareShadowResult({ legacy: false, rbac: false }).classification, "MATCH");
  assert.equal(compareShadowResult({ legacy: true, rbac: false }).classification, "RESTRICTIVE_MISMATCH");
  assert.equal(compareShadowResult({ legacy: false, rbac: true }).classification, "SECURITY_CRITICAL_MISMATCH");
});

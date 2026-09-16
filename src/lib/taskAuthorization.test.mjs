import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildTaskListScope,
  canTaskBase,
  decideTaskAuthorization,
  parseTaskRbacV2Enabled,
  taskBasePermission,
} from "./taskAuthorization.ts";

const task = {
  kind: "task",
  id: "task-1",
  departmentId: "dep-a",
  createdBy: "creator",
  ownerId: "owner",
  assigneeId: "assignee",
  reviewerId: "reviewer",
  participantIds: ["watcher"],
};

test("TASK_RBAC_V2_ENABLED is server-only and defaults every unrecognized value to legacy", () => {
  const source = readFileSync(new URL("./taskRbacFlag.ts", import.meta.url), "utf8");
  assert.match(source, /import "server-only"/);
  assert.match(source, /process\.env\.TASK_RBAC_V2_ENABLED/);
  assert.doesNotMatch(source, /NEXT_PUBLIC/);

  for (const value of [undefined, null, "", " ", "false", "0", "1", "yes", "enabled", "tru", "true-ish"]) {
    assert.equal(parseTaskRbacV2Enabled(value), false, String(value));
  }
  assert.equal(parseTaskRbacV2Enabled("true"), true);
  assert.equal(parseTaskRbacV2Enabled(" TRUE "), true);
});

test("flag off preserves legacy and flag on requires RBAC base plus workflow guard", () => {
  assert.deepEqual(
    decideTaskAuthorization({ enabled: false, legacyAllowed: true, rbacBaseAllowed: false }),
    { legacyAllowed: true, rbacBaseAllowed: false, workflowAllowed: true, finalAllowed: true },
  );
  assert.equal(decideTaskAuthorization({ enabled: false, legacyAllowed: false, rbacBaseAllowed: true }).finalAllowed, false);
  assert.equal(decideTaskAuthorization({ enabled: true, legacyAllowed: true, rbacBaseAllowed: true }).finalAllowed, true);
  assert.equal(decideTaskAuthorization({ enabled: true, legacyAllowed: true, rbacBaseAllowed: false }).finalAllowed, false);
  assert.equal(decideTaskAuthorization({ enabled: true, legacyAllowed: false, rbacBaseAllowed: true }).finalAllowed, false);
});

test("workflow mutations use task.view only as base resource access", () => {
  for (const action of [
    "report", "complete_assigned", "review", "update", "assigned_cancel",
    "attachment", "personal_edit", "personal_deadline", "personal_cancel",
    "personal_complete",
  ]) {
    assert.equal(taskBasePermission(action, "phong_vien"), "task.view", action);
    const decision = decideTaskAuthorization({
      enabled: true,
      legacyAllowed: false,
      rbacBaseAllowed: true,
    });
    assert.equal(decision.finalAllowed, false, `${action} must retain its workflow denial`);
  }
});

test("static task permissions map without turning create into assignment", () => {
  assert.equal(taskBasePermission("view", "phong_vien"), "task.view");
  assert.equal(taskBasePermission("comment", "phong_vien"), "task.comment");
  assert.equal(taskBasePermission("assign", "truong_phong"), "task.assign");
  assert.equal(taskBasePermission("admin_edit", "admin"), "task.edit_all");
  assert.equal(taskBasePermission("evaluate", "truong_phong"), "task.evaluate.step1");
  assert.equal(taskBasePermission("leader_evaluate", "tong_bien_tap"), "task.evaluate.step2");
  assert.equal(taskBasePermission("leader_evaluate", "truong_phong"), "task.evaluate.step1");

  const createOnly = {
    id: "employee",
    departmentId: "dep-a",
    grants: [{ permissionCode: "task.create", scope: "all" }],
  };
  assert.equal(canTaskBase(createOnly, "task.create"), true);
  assert.equal(canTaskBase(createOnly, "task.assign", { ...task, departmentId: "dep-b" }), false);
});

test("task view preserves the canonical legacy creator relationship", () => {
  const manager = {
    id: "manager",
    departmentId: "dep-a",
    grants: [
      { permissionCode: "task.view", scope: "assigned" },
      { permissionCode: "task.view", scope: "department" },
    ],
  };
  assert.equal(canTaskBase(manager, "task.view", { ...task, departmentId: "dep-b", createdBy: "manager" }), true);
  assert.equal(canTaskBase(manager, "task.view", { ...task, departmentId: "dep-b", createdBy: "other" }), false);
});

test("RBAC list scope is server-side, legacy-equivalent, and bounded", () => {
  const manager = {
    id: "manager",
    departmentId: "dep-a",
    grants: [
      { permissionCode: "task.view", scope: "assigned" },
      { permissionCode: "task.view", scope: "department" },
    ],
  };
  const result = buildTaskListScope(manager, ["task-2", "task-3"]);
  assert.equal(result.all, false);
  assert.deepEqual(result.terms, [
    "created_by.eq.manager",
    "owner_id.eq.manager",
    "assignee_id.eq.manager",
    "reviewer_id.eq.manager",
    "department_id.eq.dep-a",
    "id.in.(task-2,task-3)",
  ]);

  const organization = buildTaskListScope({
    id: "admin",
    departmentId: null,
    grants: [{ permissionCode: "task.view", scope: "all" }],
  }, []);
  assert.deepEqual(organization, { all: true, terms: [] });
});

import assert from "node:assert/strict";
import test from "node:test";

import { canAssignToDepartment, canTaskAction } from "./authorization.ts";
import { can } from "./rbac/authorization.ts";
import { compareShadowResult } from "./rbac/shadow.ts";
import { normalizePermissions } from "./permissions.ts";

const rolePermissions = {
  admin: { can_assign_task: true, can_view_department_tasks: true, can_comment: true, can_create_task: true, can_edit_all_tasks: true, can_evaluate_step1: true },
  tong_bien_tap: { can_assign_task: true, can_view_department_tasks: true, can_comment: true, can_create_task: true, can_evaluate_step2: true },
  pho_tong_bien_tap: { can_assign_task: true, can_view_department_tasks: true, can_comment: true, can_create_task: true },
  truong_phong: { can_assign_task: true, can_view_department_tasks: true, can_comment: true, can_create_task: true },
  pho_truong_phong: { can_assign_task: true, can_view_department_tasks: true, can_comment: true, can_create_task: true },
  phong_vien: { can_comment: true, can_create_task: true },
  nhan_vien: { can_comment: true, can_create_task: true },
  tbt_read_only: {},
  bien_tap_vien: { can_comment: true, can_create_task: true, can_edit_all_tasks: true },
  tri_su: { can_comment: true, can_create_task: true, can_edit_all_tasks: true },
};

const grantScopes = {
  admin: { "task.view": ["all"], "task.comment": ["all"], "task.assign": ["all"], "task.create": ["all"] },
  tong_bien_tap: { "task.view": ["all"], "task.comment": ["all"], "task.assign": ["all"], "task.create": ["all"] },
  pho_tong_bien_tap: { "task.view": ["assigned", "department"], "task.comment": ["assigned", "department"], "task.assign": ["all"], "task.create": ["all"] },
  truong_phong: { "task.view": ["assigned", "department"], "task.comment": ["assigned", "department"], "task.assign": ["department"], "task.create": ["all"] },
  pho_truong_phong: { "task.view": ["assigned", "department"], "task.comment": ["assigned", "department"], "task.assign": ["department"], "task.create": ["all"] },
  phong_vien: { "task.view": ["self", "assigned"], "task.comment": ["self", "assigned"], "task.create": ["all"] },
  nhan_vien: { "task.view": ["self", "assigned"], "task.comment": ["self", "assigned"], "task.create": ["all"] },
  tbt_read_only: { "task.view": ["all"] },
  bien_tap_vien: { "task.view": ["self", "assigned"], "task.comment": ["self", "assigned"], "task.create": ["all"] },
  tri_su: { "task.view": ["self", "assigned"], "task.comment": ["self", "assigned"], "task.create": ["all"] },
};

const task = (overrides = {}) => ({
  kind: "task", id: "task", departmentId: "dep-a", createdBy: "creator", ownerId: "owner", assigneeId: "assignee", reviewerId: "reviewer", selfClaimable: false, taskType: "assigned", status: "in_progress", participants: [], participantIds: [], ...overrides,
});

function fixture(roleCode, actorId = "actor", departmentId = "dep-a") {
  const grants = Object.entries(grantScopes[roleCode] ?? {})
    .flatMap(([permissionCode, scopes]) => scopes.map((scope) => ({ permissionCode, scope })));
  return {
    legacy: { id: actorId, departmentId, roleCode, roleLevel: 1, permissions: normalizePermissions(rolePermissions[roleCode]) },
    rbac: { id: actorId, departmentId, grants },
  };
}

test("legacy versus RBAC matrix has no security-critical mismatch for view/comment", () => {
  const roles = Object.keys(grantScopes);
  const resources = [
    task({ ownerId: "actor" }),
    task({ assigneeId: "actor" }),
    task({ departmentId: "dep-a" }),
    task({ departmentId: "dep-b" }),
  ];
  const rows = [];
  for (const role of roles) {
    for (const resource of resources) {
      const { legacy, rbac } = fixture(role);
      for (const action of ["view", "comment"]) {
        const permission = action === "view" ? "task.view" : "task.comment";
        const result = compareShadowResult({
          legacy: canTaskAction(legacy, resource, action),
          rbac: can(rbac, permission, resource),
        });
        rows.push({ role, action, resource, ...result });
      }
    }
  }
  const critical = rows.filter((row) => row.classification === "SECURITY_CRITICAL_MISMATCH");
  const restrictive = rows.filter((row) => row.classification === "RESTRICTIVE_MISMATCH");
  console.log(`checkpoint2-view-comment rows=${rows.length} match=${rows.length - critical.length - restrictive.length} restrictive=${restrictive.length} critical=${critical.length}`);
  assert.equal(critical.length, 0, JSON.stringify(critical, null, 2));
  assert.equal(restrictive.length, 0, JSON.stringify(restrictive, null, 2));
});

test("assignment scope matches live legacy policy for every characterized role", () => {
  const rows = [];
  for (const role of Object.keys(grantScopes)) {
    const { legacy, rbac } = fixture(role);
    for (const [resourceCase, departmentId] of [["same_department", "dep-a"], ["other_department", "dep-b"], ["organization", null]]) {
      const legacyResult = canAssignToDepartment(legacy, departmentId);
      const rbacResult = can(rbac, "task.assign", { ...task(), departmentId });
      rows.push({ role, resourceCase, ...compareShadowResult({ legacy: legacyResult, rbac: rbacResult }) });
    }
  }
  const critical = rows.filter((row) => row.classification === "SECURITY_CRITICAL_MISMATCH");
  const restrictive = rows.filter((row) => row.classification === "RESTRICTIVE_MISMATCH");
  console.log(`checkpoint2-assignment rows=${rows.length} match=${rows.length - critical.length - restrictive.length} restrictive=${restrictive.length} critical=${critical.length}`);
  assert.equal(critical.length, 0, JSON.stringify(critical, null, 2));
  assert.equal(restrictive.length, 0, JSON.stringify(restrictive, null, 2));
});

test("task.create never implies task.assign outside the legacy assignment scope", () => {
  for (const role of ["phong_vien", "nhan_vien", "bien_tap_vien", "tri_su"]) {
    const { legacy, rbac } = fixture(role, "actor", "dep-a");
    assert.equal(legacy.permissions.can_create_task, true, role);
    assert.equal(can(rbac, "task.create"), true, role);
    assert.equal(canAssignToDepartment(legacy, "dep-b"), false, role);
    assert.equal(can(rbac, "task.assign", { ...task(), departmentId: "dep-b" }), false, role);
  }
});

test("full required action matrix records workflow-dependent actions as needs review", () => {
  const workflowActions = [
    ["task.submit", "report"],
    ["task.return", "review"],
    ["task.approve", "review"],
    ["task.score", "review"],
    ["task.cancel", "assigned_cancel"],
    ["task.reopen", "update"],
    ["task.update", "update"],
    ["task.deadline/change deadline", "update"],
    ["task.attachment", "attachment"],
  ];
  const rows = [];
  for (const role of Object.keys(grantScopes)) {
    const { legacy } = fixture(role);
    for (const [label, legacyAction] of workflowActions) {
      rows.push({
        role,
        action: label,
        legacyResult: canTaskAction(legacy, task({ ownerId: "actor", assigneeId: "actor" }), legacyAction),
        resultType: "NEEDS_REVIEW",
      });
    }
  }
  console.log(`checkpoint2-workflow rows=${rows.length} needs_review=${rows.filter((row) => row.resultType === "NEEDS_REVIEW").length}`);
  assert.equal(rows.length, Object.keys(grantScopes).length * workflowActions.length);
  assert.ok(rows.every((row) => row.resultType === "NEEDS_REVIEW"));
});

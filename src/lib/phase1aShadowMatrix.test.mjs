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
};

const grantsByRole = {
  admin: ["all"],
  tong_bien_tap: ["all"],
  pho_tong_bien_tap: ["assigned", "department"],
  truong_phong: ["assigned", "department"],
  pho_truong_phong: ["assigned", "department"],
  phong_vien: ["self", "assigned"],
  nhan_vien: ["self", "assigned"],
  tbt_read_only: ["all"],
};

const task = (overrides = {}) => ({
  kind: "task", id: "task", departmentId: "dep-a", createdBy: "creator", ownerId: "owner", assigneeId: "assignee", reviewerId: "reviewer", selfClaimable: false, taskType: "assigned", status: "in_progress", participants: [], participantIds: [], ...overrides,
});

function fixture(roleCode, actorId = "actor", departmentId = "dep-a") {
  const scopes = grantsByRole[roleCode] ?? [];
  const permissions = roleCode === "tbt_read_only" ? ["task.view"] : ["task.view", "task.comment"];
  if (["truong_phong", "pho_truong_phong", "pho_tong_bien_tap", "tong_bien_tap", "admin"].includes(roleCode)) permissions.push("task.assign");
  const grants = permissions.flatMap((permissionCode) => scopes.map((scope) => ({ permissionCode, scope })));
  return {
    legacy: { id: actorId, departmentId, roleCode, roleLevel: 1, permissions: normalizePermissions(rolePermissions[roleCode]) },
    rbac: { id: actorId, departmentId, grants },
  };
}

test("legacy versus RBAC matrix has no security-critical mismatch for view/comment", () => {
  const roles = Object.keys(grantsByRole);
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
  assert.equal(critical.length, 0, JSON.stringify(critical, null, 2));
});

test("department assignment remains department-scoped in both layers", () => {
  for (const role of ["truong_phong", "pho_truong_phong"]) {
    const { legacy, rbac } = fixture(role);
    assert.equal(canAssignToDepartment(legacy, "dep-a"), true);
    assert.equal(canAssignToDepartment(legacy, "dep-b"), false);
    assert.equal(can(rbac, "task.assign", { ...task(), departmentId: "dep-a" }), true);
    assert.equal(can(rbac, "task.assign", { ...task(), departmentId: "dep-b" }), false);
  }
});

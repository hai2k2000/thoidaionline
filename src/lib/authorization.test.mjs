import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PERMISSION_KEYS,
  normalizePermissions,
} from "./permissions.ts";

test("permission normalization returns the complete stable contract", () => {
  const permissions = normalizePermissions({
    can_assign_task: true,
    can_evaluate_step2: 1,
  });

  assert.deepEqual(Object.keys(permissions), [...PERMISSION_KEYS]);
  assert.equal(permissions.can_assign_task, true);
  assert.equal(permissions.can_evaluate_step2, false);
  assert.equal(permissions.can_manage_rubrics, false);
  assert.equal(permissions.can_manage_users, false);
});

test("server session selects role level, department and every new permission", () => {
  const source = readFileSync(
    new URL("./serverSession.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /department_id/);
  assert.match(source, /department_id:\s*string\s*\|\s*null/);
  assert.doesNotMatch(source, /!row\.department_id/);
  assert.match(source, /role_level/);
  for (const key of [
    "can_assign_task",
    "can_view_department_tasks",
    "can_evaluate_step1",
    "can_evaluate_step2",
    "can_manage_rubrics",
  ]) {
    assert.match(source, new RegExp(key));
  }
  assert.match(source, /session\.sessionVersion\s*!==\s*row\.session_version/);
  assert.match(source, /normalizePermissions/);
});
import {
  canAssignToDepartment,
  canEvaluationAction,
  canTaskAction,
} from "./authorization.ts";

const actor = (
  overrides = {},
) => ({
  id: "actor",
  departmentId: "dep-a",
  roleCode: "phong_vien",
  roleLevel: 1,
  permissions: normalizePermissions({ can_comment: true }),
  ...overrides,
});

const task = (
  overrides = {},
) => ({
  id: "task",
  departmentId: "dep-a",
  createdBy: "creator",
  ownerId: "owner",
  assigneeId: "assignee",
  reviewerId: "reviewer",
  selfClaimable: false,
  status: "in_progress",
  participants: [
    { userId: "assignee", assignmentRole: "assignee" },
    { userId: "watcher", assignmentRole: "watcher" },
  ],
  ...overrides,
});

test("related actors and scoped managers can view; unrelated staff cannot", () => {
  assert.equal(canTaskAction(actor({ id: "assignee" }), task(), "view"), true);
  assert.equal(canTaskAction(actor({ id: "watcher" }), task(), "view"), true);
  assert.equal(canTaskAction(actor({ id: "creator" }), task(), "view"), true);
  assert.equal(canTaskAction(actor({ id: "other" }), task(), "view"), false);
  assert.equal(canTaskAction(actor({
    id: "manager",
    permissions: normalizePermissions({
      can_view_department_tasks: true,
      can_comment: true,
    }),
  }), task(), "view"), true);
  assert.equal(canTaskAction(actor({
    id: "manager",
    departmentId: "dep-b",
    permissions: normalizePermissions({
      can_view_department_tasks: true,
      can_comment: true,
    }),
  }), task(), "view"), false);
});

test("TBT can view, comment and assign organization-wide but cannot use unrelated task mutations", () => {
  const tbt = actor({
    roleCode: "tong_bien_tap",
    roleLevel: 4,
    permissions: normalizePermissions({
      can_comment: true,
      can_evaluate_step2: true,
    }),
  });
  assert.equal(canTaskAction(tbt, task({ departmentId: "dep-z" }), "view"), true);
  assert.equal(canTaskAction(tbt, task({ departmentId: "dep-z" }), "comment"), true);
  assert.equal(canTaskAction(actor({
    roleCode: "tong_bien_tap",
    roleLevel: 4,
    permissions: normalizePermissions({ can_evaluate_step2: true }),
  }), task({ departmentId: "dep-z" }), "comment"), false);
  for (const action of [
    "update", "claim", "report",
    "review", "legacy_evaluate",
  ]) {
    assert.equal(canTaskAction(tbt, task(), action), false, action);
  }
});

test("compatibility tbt_read_only can view globally and mutate nothing", () => {
  const readOnly = actor({ roleCode: "tbt_read_only", roleLevel: 0 });
  assert.equal(canTaskAction(readOnly, task({ departmentId: "dep-z" }), "view"), true);
  assert.equal(canTaskAction(readOnly, task(), "comment"), false);
  assert.equal(canEvaluationAction(readOnly, {
    action: "step2",
    employeeId: "employee",
    employeeDepartmentId: "dep-a",
    managerId: "manager",
  }), false);
});

test("assign, report, review, update and comment require explicit permission plus relationship", () => {
  const manager = actor({
    id: "manager",
    permissions: normalizePermissions({
      can_assign_task: true,
      can_view_department_tasks: true,
      can_evaluate_step1: true,
      can_comment: true,
    }),
  });
  assert.equal(canAssignToDepartment(manager, "dep-a"), true);
  assert.equal(canAssignToDepartment(manager, "dep-b"), false);
  assert.equal(canAssignToDepartment(actor({
    roleCode: "pho_tong_bien_tap",
    permissions: normalizePermissions({ can_assign_task: true }),
  }), "dep-b"), true);
  assert.equal(canTaskAction(manager, task(), "update"), true);
  assert.equal(canTaskAction(actor({ id: "assignee" }), task(), "report"), true);
  assert.equal(canTaskAction(actor({ id: "watcher" }), task(), "report"), false);
  assert.equal(canTaskAction(manager, task({ reviewerId: "manager", departmentManagerId: "manager" }), "review"), true);
  assert.equal(canTaskAction(manager, task({ reviewerId: "other", departmentManagerId: "manager" }), "review"), false);
  assert.equal(canTaskAction(actor({ id: "tbt", roleCode: "tong_bien_tap" }), task({ reviewerId: "tbt" }), "review"), true);
  assert.equal(canTaskAction(actor({ id: "deputy", roleCode: "pho_truong_phong" }), task({ reviewerId: "deputy" }), "review"), true);
  assert.equal(canTaskAction(actor({ id: "creator" }), task({ createdBy: "creator", reviewerId: "other" }), "review"), false);
  assert.equal(canTaskAction(actor({ id: "watcher" }), task(), "comment"), true);
  assert.equal(canTaskAction(actor({ id: "other" }), task(), "comment"), false);
});

test("null departments never create same-department authority", () => {
  const manager = actor({
    departmentId: null,
    permissions: normalizePermissions({
      can_assign_task: true,
      can_view_department_tasks: true,
      can_evaluate_step1: true,
    }),
  });
  assert.equal(canAssignToDepartment(manager, null), false);
  assert.equal(canTaskAction(manager, task({ departmentId: null }), "view"), false);
  assert.equal(canEvaluationAction(manager, {
    action: "step1",
    employeeId: "employee",
    employeeDepartmentId: null,
    managerId: "actor",
  }), false);
});

test("claim requires an available self-claimable task", () => {
  const staff = actor({ id: "staff" });
  assert.equal(canTaskAction(staff, task({
    selfClaimable: true,
    assigneeId: null,
    status: "new",
  }), "claim"), true);
  assert.equal(canTaskAction(staff, task({
    selfClaimable: false,
    assigneeId: null,
    status: "new",
  }), "claim"), false);
  assert.equal(canTaskAction(staff, task({
    selfClaimable: true,
    assigneeId: "other",
    status: "new",
  }), "claim"), false);
});

test("step1 follows primary-manager relationship and step2 is TBT-only", () => {
  const manager = actor({
    id: "manager",
    permissions: normalizePermissions({ can_evaluate_step1: true }),
  });
  assert.equal(canEvaluationAction(manager, {
    action: "step1",
    employeeId: "employee",
    employeeDepartmentId: "dep-a",
    managerId: "manager",
  }), true);
  assert.equal(canEvaluationAction(manager, {
    action: "step1",
    employeeId: "manager",
    employeeDepartmentId: "dep-a",
    managerId: "manager",
  }), false);

  const tbt = actor({
    roleCode: "tong_bien_tap",
    permissions: normalizePermissions({ can_evaluate_step2: true }),
  });
  assert.equal(canEvaluationAction(tbt, {
    action: "step2",
    employeeId: "employee",
    employeeDepartmentId: "dep-a",
    managerId: "manager",
  }), true);
  assert.equal(canEvaluationAction(manager, {
    action: "step2",
    employeeId: "employee",
    employeeDepartmentId: "dep-a",
    managerId: "manager",
  }), false);
});

test("only an explicitly permitted Admin manages shared rubrics", () => {
  assert.equal(canEvaluationAction(actor({
    roleCode: "admin",
    permissions: normalizePermissions({ can_manage_rubrics: true }),
  }), { action: "manage_rubrics" }), true);
  assert.equal(canEvaluationAction(actor({
    roleCode: "tong_bien_tap",
    permissions: normalizePermissions({
      can_evaluate_step2: true,
      can_manage_rubrics: true,
    }),
  }), { action: "manage_rubrics" }), false);
});

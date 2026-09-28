import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizePermissions } from "./permissions.ts";
import { canTaskAction } from "./authorization.ts";

const actor = (overrides = {}) => ({
  id: "creator", departmentId: "dep-a", roleCode: "phong_vien", roleLevel: 1,
  permissions: normalizePermissions({}), ...overrides,
});
const task = (overrides = {}) => ({
  id: "task", departmentId: "dep-a", createdBy: "creator", ownerId: "creator",
  assigneeId: "creator", reviewerId: "manager", departmentManagerId: "manager",
  selfClaimable: false, taskType: "personal", status: "waiting", approvalRequired: true,
  assignmentApprovalState: "pending", participants: [], ...overrides,
});

test("creator can edit/cancel own unapproved waiting and rejected tasks", () => {
  for (const state of [
    { status: "waiting", assignmentApprovalState: "pending" },
    { status: "rejected", assignmentApprovalState: "rejected" },
  ]) {
    const value = task(state);
    assert.equal(canTaskAction(actor(), value, "personal_edit"), true);
    assert.equal(canTaskAction(actor(), value, "personal_deadline"), true);
    assert.equal(canTaskAction(actor(), value, "personal_cancel"), true);
  }
});

test("non-admin may edit/cancel until completion approval", () => {
  const inProgress = task({ status: "in_progress", assignmentApprovalState: "approved" });
  assert.equal(canTaskAction(actor(), inProgress, "personal_edit"), true);
  assert.equal(canTaskAction(actor(), inProgress, "personal_cancel"), true);
  const pendingReview = task({ status: "pending_review", assignmentApprovalState: "approved" });
  assert.equal(canTaskAction(actor(), pendingReview, "personal_edit"), true);
  assert.equal(canTaskAction(actor(), pendingReview, "personal_cancel"), true);
  const approved = task({ status: "done", assignmentApprovalState: "approved" });
  assert.equal(canTaskAction(actor(), approved, "personal_edit"), false);
  assert.equal(canTaskAction(actor(), approved, "personal_cancel"), false);
});

test("only admin may edit or cancel after completion approval, including terminal tasks", () => {
  const approved = task({ status: "in_progress", assignmentApprovalState: "approved", taskType: "assigned" });
  const admin = actor({ id: "admin", roleCode: "admin" });
  const manager = actor({ id: "manager", roleCode: "truong_phong", permissions: normalizePermissions({ can_assign_task: true }) });
  assert.equal(canTaskAction(manager, approved, "update"), true);
  assert.equal(canTaskAction(manager, approved, "assigned_cancel"), true);
  assert.equal(canTaskAction(admin, task({ ...approved, status: "done" }), "update"), true);
  assert.equal(canTaskAction(admin, task({ ...approved, status: "done" }), "assigned_cancel"), true);
  assert.equal(canTaskAction(admin, task({ ...approved, status: "cancelled" }), "update"), true);
});

test("admin and scoped manager authority remains available", () => {
  const approved = task({ status: "in_progress", assignmentApprovalState: "approved", taskType: "assigned" });
  assert.equal(canTaskAction(actor({ id: "admin", roleCode: "admin" }), approved, "update"), true);
  assert.equal(canTaskAction(actor({ id: "manager", roleCode: "truong_phong", permissions: normalizePermissions({ can_assign_task: true }) }), approved, "update"), true);
  assert.equal(canTaskAction(actor({ id: "tbt", roleCode: "tong_bien_tap" }), approved, "update"), false);
});

test("hard delete is not exposed by the task action contract", () => {
  const source = readFileSync(new URL("./authorization.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /hard_delete|delete_task/i);
  assert.doesNotMatch(source, /case ["']delete["']/);
});

test("permission migration locks and rechecks every affected mutation", () => {
  const migration = readFileSync(new URL("../../supabase/migrations/20260928160000_admin_edit_cancel_after_approval.sql", import.meta.url), "utf8");
  for (const rpc of ["api_update_task", "api_edit_personal_task", "api_cancel_personal_task", "api_cancel_assigned_task"]) {
    assert.match(migration, new RegExp(`create or replace function public\\.${rpc}`));
  }
  assert.equal((migration.match(/for update/g) ?? []).length >= 2, true);
  assert.match(migration, /status in \('done','cancelled'\)/);
  assert.match(migration, /status='done' and v_role_code<>'admin'/);
  assert.match(migration, /task_status_events/);
  assert.match(migration, /cancelled_at/);
  assert.match(migration, /cancelled_by/);
  assert.match(migration, /cancel_reason/);
  assert.match(migration, /audit_logs/);
  assert.doesNotMatch(migration, /drop table|drop column|delete\s+from/i);
});

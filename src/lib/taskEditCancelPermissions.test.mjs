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

test("creator loses edit/cancel after assignment approval, not after completion approval", () => {
  const approved = task({ status: "in_progress", assignmentApprovalState: "approved" });
  assert.equal(canTaskAction(actor(), approved, "personal_edit"), false);
  assert.equal(canTaskAction(actor(), approved, "personal_cancel"), false);
  const completionOnly = task({ status: "pending_review", assignmentApprovalState: "pending" });
  assert.equal(canTaskAction(actor(), completionOnly, "personal_edit"), true);
  assert.equal(canTaskAction(actor(), completionOnly, "personal_cancel"), true);
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
  const migration = readFileSync(new URL("../../supabase/migrations/20260927100000_task_edit_cancel_permissions.sql", import.meta.url), "utf8");
  for (const rpc of ["api_update_task", "api_edit_personal_task", "api_cancel_personal_task", "api_cancel_assigned_task"]) {
    assert.match(migration, new RegExp(`create or replace function public\\.${rpc}`));
  }
  assert.equal((migration.match(/for update/g) ?? []).length >= 2, true);
  assert.match(migration, /from_status='waiting'\s+and\s+e\.to_status='in_progress'/);
  assert.match(migration, /task_status_events/);
  assert.match(migration, /cancelled_at/);
  assert.match(migration, /cancelled_by/);
  assert.match(migration, /cancel_reason/);
  assert.match(migration, /audit_logs/);
  assert.doesNotMatch(migration, /drop table|drop column|delete\s+from/i);
});

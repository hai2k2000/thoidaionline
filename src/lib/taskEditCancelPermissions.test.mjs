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

test("creator keeps mutation rights for every pending task status despite assignment metadata", () => {
  for (const value of [
    task({ status: "new", assignmentApprovalState: "approved" }),
    task({ status: "in_progress", assignmentApprovalState: "approved" }),
    task({ status: "blocked", assignmentApprovalState: "approved" }),
    task({ status: "waiting", assignmentApprovalState: "approved" }),
    task({ status: "rejected", assignmentApprovalState: "approved" }),
    task({ status: "pending_review", assignmentApprovalState: "approved" }),
  ]) {
    assert.equal(canTaskAction(actor(), value, "personal_edit"), true);
    assert.equal(canTaskAction(actor(), value, "personal_cancel"), true);
  }
});

test("creator is blocked only at done, while cancelled remains immutable", () => {
  for (const value of [task({ status: "done", assignmentApprovalState: "approved" }), task({ status: "cancelled" })]) {
    assert.equal(canTaskAction(actor(), value, "personal_edit"), false);
    assert.equal(canTaskAction(actor(), value, "personal_cancel"), false);
  }
});

test("only admin may edit or cancel approved tasks, including terminal tasks", () => {
  const approved = task({ status: "done", assignmentApprovalState: "approved", taskType: "assigned" });
  const admin = actor({ id: "admin", roleCode: "admin" });
  const manager = actor({ id: "manager", roleCode: "truong_phong", permissions: normalizePermissions({ can_assign_task: true }) });
  assert.equal(canTaskAction(manager, approved, "update"), false);
  assert.equal(canTaskAction(manager, approved, "assigned_cancel"), false);
  assert.equal(canTaskAction(admin, approved, "update"), true);
  assert.equal(canTaskAction(admin, approved, "assigned_cancel"), true);
  assert.equal(canTaskAction(admin, task({ ...approved, status: "cancelled" }), "update"), false);
  assert.equal(canTaskAction(admin, task({ ...approved, status: "cancelled" }), "assigned_cancel"), false);
});

test("admin mutation actions fail closed when creator identity is missing", () => {
  const admin = actor({ id: "admin", roleCode: "admin" });
  const legacy = task({ createdBy: null, status: "done", assignmentApprovalState: "approved" });
  assert.equal(canTaskAction(admin, legacy, "admin_edit"), false);
  assert.equal(canTaskAction(admin, legacy, "update"), false);
  assert.equal(canTaskAction(admin, legacy, "assigned_cancel"), false);
});

test("unrelated managers and leadership cannot edit or cancel another creator's task", () => {
  const approved = task({ status: "in_progress", assignmentApprovalState: "approved", taskType: "assigned" });
  const manager = actor({ id: "manager", roleCode: "truong_phong", permissions: normalizePermissions({ can_assign_task: true }) });
  const tbt = actor({ id: "tbt", roleCode: "tong_bien_tap" });
  assert.equal(canTaskAction(manager, approved, "update"), false);
  assert.equal(canTaskAction(manager, approved, "assigned_cancel"), false);
  assert.equal(canTaskAction(tbt, approved, "update"), false);
  assert.equal(canTaskAction(tbt, approved, "assigned_cancel"), false);
});

test("leadership creator keeps pending mutation rights", () => {
  const pending = task({ status: "waiting", assignmentApprovalState: "pending", taskType: "assigned" });
  const tbt = actor({ id: "creator", roleCode: "tong_bien_tap", roleLevel: 4 });
  assert.equal(canTaskAction(tbt, pending, "update"), true);
  assert.equal(canTaskAction(tbt, pending, "assigned_cancel"), true);
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

test("creator-only mutation migration blocks scoped managers and permits admin overrides", () => {
  const migration = readFileSync(new URL("../../supabase/migrations/20260929110000_creator_only_task_edit_cancel.sql", import.meta.url), "utf8");
  for (const rpc of ["api_update_task", "api_cancel_assigned_task", "api_change_assigned_task_deadline", "api_edit_personal_task", "api_cancel_personal_task", "api_change_personal_task_deadline"]) {
    assert.match(migration, new RegExp(`create or replace function public\\.${rpc}`));
  }
  assert.match(migration, /v_role_code<>'admin'/);
  assert.match(migration, /v_before\.created_by (?:is distinct from|<>)/);
  assert.match(migration, /status='cancelled'/);
  assert.doesNotMatch(migration, /delete\s+from|drop table|drop column/i);
});

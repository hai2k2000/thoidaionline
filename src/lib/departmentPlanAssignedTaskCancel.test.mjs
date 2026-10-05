import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizePermissions } from "./permissions.ts";
import { canTaskAction } from "./authorization.ts";

const migration = readFileSync(new URL("../../supabase/migrations/20261005100000_department_plan_assigned_task_cancel_sync.sql", import.meta.url), "utf8");
const accessSource = readFileSync(new URL("./taskRepository.ts", import.meta.url), "utf8");
const bulkSource = readFileSync(new URL("../app/api/tasks/bulk-cancel/route.ts", import.meta.url), "utf8");
const detailSource = readFileSync(new URL("../components/TaskDetailShell.tsx", import.meta.url), "utf8");
const planHandlersSource = readFileSync(new URL("./departmentPlanHandlers.ts", import.meta.url), "utf8");
const rpcMappingSource = readFileSync(new URL("./rpcErrorMapping.ts", import.meta.url), "utf8");
const feedbackSource = readFileSync(new URL("./actionFeedback.ts", import.meta.url), "utf8");

const actor = (overrides = {}) => ({
  id: "creator", departmentId: "dep-a", roleCode: "truong_phong", roleLevel: 2,
  permissions: normalizePermissions({ can_assign_task: true }), ...overrides,
});

const task = (overrides = {}) => ({
  id: "task", departmentId: "dep-a", createdBy: "creator", ownerId: "creator",
  assigneeId: "assignee", reviewerId: "manager", departmentManagerId: "manager",
  selfClaimable: false, taskType: "assigned", status: "in_progress", approvalRequired: false,
  assignmentApprovalState: "not_required", departmentPlanLinked: true, participants: [], ...overrides,
});

test("Department Plan assigned Tasks deny cancellation to manager, assignee, and creator", () => {
  assert.equal(canTaskAction(actor(), task(), "assigned_cancel"), false);
  assert.equal(canTaskAction(actor({ id: "assignee" }), task({ createdBy: "other" }), "assigned_cancel"), false);
});

test("Department Plan assigned Task cancellation remains available to Admin", () => {
  assert.equal(canTaskAction(actor({ id: "admin", roleCode: "admin" }), task({ createdBy: "creator" }), "assigned_cancel"), true);
});

test("unlinked assigned Task keeps existing creator cancellation policy", () => {
  assert.equal(canTaskAction(actor(), task({ departmentPlanLinked: false }), "assigned_cancel"), true);
});

test("access query loads canonical Department Plan linkage", () => {
  assert.match(accessSource, /department_plan_items/);
  assert.match(accessSource, /linked_task_id/);
});

test("migration replaces assigned cancellation with Department Plan synchronized transaction", () => {
  assert.match(migration, /create or replace function public\.api_cancel_assigned_task/);
  assert.match(migration, /department_plan_items/);
  assert.match(migration, /for update/);
  assert.match(migration, /status\s*=\s*'cancelled'/);
  assert.match(migration, /close_classification\s*=\s*'CANCELLED'/);
  assert.match(migration, /carry_forward\s*=\s*false/);
  assert.match(migration, /task_status_events/);
  assert.match(migration, /audit_logs/);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.(tasks|department_plan_items)/i);
});

test("migration excludes closed historical Plan Items and blocks continuation", () => {
  assert.match(migration, /p\.status\s*=\s*'active'/);
});

test("bulk cancellation delegates every Task to canonical cancellation handlers", () => {
  assert.match(bulkSource, /cancelPersonal/);
  assert.match(bulkSource, /cancelAssigned/);
  assert.doesNotMatch(bulkSource, /from\("tasks"\).*update|\.update\(/s);
});

test("assigned cancellation returns the approved friendly message", () => {
  assert.match(rpcMappingSource, /department_plan_cancel_forbidden/);
  assert.match(feedbackSource, /Công việc đã giao từ kế hoạch phòng ban chỉ Admin mới có quyền huỷ/);
});

test("assigned Plan Items cannot be deleted through the generic Plan handler", () => {
  assert.match(planHandlersSource, /async function deleteItem/);
  assert.match(planHandlersSource, /current\.data\.linked_task_id/);
});

test("Task detail UI hides cancellation for linked Department Plan Tasks and explains Admin-only policy", () => {
  assert.match(detailSource, /departmentPlanLinked/);
  assert.match(detailSource, /Công việc đã giao từ kế hoạch phòng ban/);
});

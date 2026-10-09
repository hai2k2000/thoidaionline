import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyDepartmentPlanContinuation,
  prepareDepartmentPlanContinuationCandidates,
} from "./departmentPlanLongRunning.ts";

const PERIOD_END = "2026-10-09";
const task = (overrides = {}) => ({
  taskId: "task-1",
  title: "Công việc dài hạn",
  status: "in_progress",
  dueDate: "2026-10-12",
  assigneeId: "person-1",
  ...overrides,
});

test("A: active canonical task with deadline after period end proposes LONG_RUNNING", () => {
  assert.equal(classifyDepartmentPlanContinuation({ taskId: "task-1", status: "in_progress", dueDate: "2026-10-12", periodEnd: PERIOD_END }), "LONG_RUNNING");
});

test("B: completed task is excluded", () => {
  assert.equal(classifyDepartmentPlanContinuation({ taskId: "task-1", status: "done", dueDate: "2026-10-12", periodEnd: PERIOD_END }), null);
  assert.equal(prepareDepartmentPlanContinuationCandidates([task({ status: "completed" })], PERIOD_END).length, 0);
});

test("C: unfinished task ending inside the period is CARRY_OVER, never LONG_RUNNING", () => {
  assert.equal(classifyDepartmentPlanContinuation({ taskId: "task-1", status: "in_progress", dueDate: PERIOD_END, periodEnd: PERIOD_END }), "CARRY_OVER");
});

test("D: preview keeps canonical task, assignee, deadline and accepts period goal", () => {
  const [candidate] = prepareDepartmentPlanContinuationCandidates([task({ periodGoal: "Hoàn tất hồ sơ" })], PERIOD_END);
  assert.equal(candidate.taskId, "task-1");
  assert.equal(candidate.assigneeId, "person-1");
  assert.equal(candidate.dueDate, "2026-10-12");
  assert.equal(candidate.periodRelation, "LONG_RUNNING");
  assert.equal(candidate.periodGoal, "Hoàn tất hồ sơ");
});

test("E: existing next-period item is skipped and repeated candidates do not duplicate", () => {
  const candidates = prepareDepartmentPlanContinuationCandidates([task(), task(), task({ taskId: "task-2" })], PERIOD_END, ["task-2"]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].taskId, "task-1");
});

test("next-period preview upgrades a prior candidate to LONG_RUNNING only when its deadline exceeds the source period", () => {
  const [candidate] = prepareDepartmentPlanContinuationCandidates([task({ previousItemId: "item-1", periodRelation: "CARRY_OVER" })], "2026-10-16", [], "2026-10-09");
  assert.equal(candidate.periodRelation, "LONG_RUNNING");
  const [carry] = prepareDepartmentPlanContinuationCandidates([task({ previousItemId: "item-2", dueDate: "2026-10-09", periodRelation: "CARRY_OVER" })], "2026-10-16", [], "2026-10-09");
  assert.equal(carry.periodRelation, "CARRY_OVER");
});

test("Task count remains one while Plan item count becomes two", () => {
  const current = task();
  const next = prepareDepartmentPlanContinuationCandidates([current], PERIOD_END);
  assert.equal(new Set([current.taskId]).size, 1);
  assert.equal(next.length, 1);
  assert.equal(new Set([current.taskId, next[0].taskId]).size, 1);
});

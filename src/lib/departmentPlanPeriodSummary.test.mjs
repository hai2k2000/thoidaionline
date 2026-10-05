import assert from "node:assert/strict";
import test from "node:test";
import { summarizeDepartmentPlanPeriod } from "./departmentPlanPeriodSummary.ts";

const item = (overrides = {}) => ({
  id: crypto.randomUUID(), title: "Công việc", work_status: "planned", assignment_state: "assigned",
  period_relation: "NEW", carry_forward: false, completed_in_period: false, ...overrides,
});

test("summary separates planned and spontaneous work and excludes spontaneous from completion denominator", () => {
  const result = summarizeDepartmentPlanPeriod([
    item({ work_status: "completed", completed_in_period: true }),
    item({ period_relation: "AUTO_ADDED_DURING_PERIOD", work_status: "completed" }),
    item({ period_relation: "CARRY_OVER", carry_forward: true, work_status: "in_progress" }),
    item({ period_relation: "LONG_RUNNING", work_status: "in_progress" }),
    item({ period_relation: "RECURRING" }),
  ]);
  assert.equal(result.plannedItems.length, 4);
  assert.equal(result.spontaneousItems.length, 1);
  assert.equal(result.completedItems.length, 1);
  assert.equal(result.unfinishedItems.length, 3);
  assert.equal(result.outstandingItems.length, 3);
  assert.equal(result.carryOverItems.length, 1);
  assert.equal(result.longRunningItems.length, 1);
  assert.equal(result.recurringItems.length, 1);
  assert.equal(result.continuationItems.length, 2);
  assert.equal(result.nextPeriodItems.length, 3);
  assert.equal(result.completionRate, 25);
});

test("cancelled work is not outstanding", () => {
  const result = summarizeDepartmentPlanPeriod([item({ work_status: "cancelled" })]);
  assert.equal(result.unfinishedItems.length, 0);
  assert.equal(result.outstandingItems.length, 0);
  assert.equal(result.completionRate, 0);
});

test("monthly summary deduplicates items linked to the same canonical task", () => {
  const result = summarizeDepartmentPlanPeriod([
    item({ id: "monthly-item", linked_task_id: "task-1", work_status: "completed", completed_in_period: true }),
    item({ id: "weekly-copy", linked_task_id: "task-1", work_status: "completed", completed_in_period: true }),
  ]);
  assert.equal(result.plannedItems.length, 1);
  assert.equal(result.completionRate, 100);
});


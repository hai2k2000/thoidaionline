import test from "node:test";
import assert from "node:assert/strict";
import {
  personalWeeklyPeriod,
  dedupePersonalWeeklyTasks,
  buildNextWeekCandidates,
  validatePersonalWeeklyDraft,
} from "./personalWeeklyReport.ts";

const task = (id, overrides = {}) => ({
  taskId: id,
  title: `Task ${id}`,
  status: "in_progress",
  source: "assigned",
  ...overrides,
});

test("A: auto-populates five assigned canonical tasks", () => {
  const rows = dedupePersonalWeeklyTasks([1, 2, 3, 4, 5].map((id) => task(`task-${id}`)));
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map((row) => row.taskId), ["task-1", "task-2", "task-3", "task-4", "task-5"]);
});

test("B: labels REPORT_ONLY rows as Việc phát sinh", () => {
  const rows = dedupePersonalWeeklyTasks([
    task("quick-1", { workflowType: "REPORT_ONLY", source: "report_only" }),
    task("quick-2", { workflow_type: "REPORT_ONLY", source: "report_only" }),
  ]);
  assert.deepEqual(rows.map((row) => row.sourceLabel), ["Việc phát sinh", "Việc phát sinh"]);
});

test("C: merges duplicate source links into one canonical task row", () => {
  const rows = dedupePersonalWeeklyTasks([
    task("task-1", { source: "assigned" }),
    task("task-1", { source: "department_plan", periodRelation: "RECURRING" }),
  ]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].sourceLabels, ["Kế hoạch phòng ban", "Công việc được giao"]);
  assert.equal(rows[0].sourceLabel, "Kế hoạch phòng ban");
});


test("a Department Plan source stays primary regardless of input order", () => {
  const rows = dedupePersonalWeeklyTasks([
    task("plan-1", { source: "department_plan" }),
    task("plan-1", { source: "assigned" }),
  ]);
  assert.equal(rows[0].sourceLabel, "Kế hoạch phòng ban");
  assert.deepEqual(rows[0].sourceLabels, ["Kế hoạch phòng ban", "Công việc được giao"]);
});

test("D/E: reuses active LONG_RUNNING and CARRY_OVER task IDs", () => {
  const rows = buildNextWeekCandidates([
    task("long-1", { periodRelation: "LONG_RUNNING" }),
    task("carry-1", { periodRelation: "CARRY_OVER" }),
  ], { start: "2026-10-09", end: "2026-10-16" });
  assert.deepEqual(rows.map((row) => row.taskId), ["long-1", "carry-1"]);
  assert.deepEqual(rows.map((row) => row.periodRelation), ["LONG_RUNNING", "CARRY_OVER"]);
});

test("F/G: excludes done and cancelled continuation tasks", () => {
  const rows = buildNextWeekCandidates([
    task("done", { status: "done", periodRelation: "LONG_RUNNING" }),
    task("cancelled", { status: "cancelled", periodRelation: "CARRY_OVER" }),
    task("active", { status: "in_progress", periodRelation: "RECURRING", recurrenceRule: { active: true, starts_on: "2026-10-01", ends_on: null, next_scheduled_for: "2026-10-12" } }),
  ], { start: "2026-10-09", end: "2026-10-16" });
  assert.deepEqual(rows.map((row) => row.taskId), ["active"]);
});

test("recurrence continues only when an active scheduled rule falls in the next period", () => {
  const rule = (overrides = {}) => ({ active: true, starts_on: "2026-10-01", ends_on: "2026-10-31", next_scheduled_for: "2026-10-12", ...overrides });
  const rows = buildNextWeekCandidates([
    task("valid", { periodRelation: "RECURRING", recurrenceRule: rule() }),
    task("missing", { periodRelation: "RECURRING" }),
    task("inactive", { periodRelation: "RECURRING", recurrenceRule: rule({ active: false }) }),
    task("early", { periodRelation: "RECURRING", recurrenceRule: rule({ starts_on: "2026-10-13" }) }),
    task("expired", { periodRelation: "RECURRING", recurrenceRule: rule({ ends_on: "2026-10-11" }) }),
    task("late", { periodRelation: "RECURRING", recurrenceRule: rule({ next_scheduled_for: "2026-10-16" }) }),
  ], { start: "2026-10-09", end: "2026-10-16" });
  assert.deepEqual(rows.map((row) => row.taskId), ["valid"]);
});

test("M: uses exact Friday-to-Friday current and next boundaries", () => {
  assert.deepEqual(personalWeeklyPeriod("2026-10-02"), {
    current: { start: "2026-10-02", end: "2026-10-09" },
    next: { start: "2026-10-09", end: "2026-10-16" },
  });
});

test("rejects duplicate task IDs in draft rows", () => {
  const result = validatePersonalWeeklyDraft({ currentRows: [task("same"), task("same")] });
  assert.equal(result.ok, false);
  assert.match(result.message, /duplicate/i);
});

test("allows a continuation task to appear in both current and next rows", () => {
  const result = validatePersonalWeeklyDraft({
    currentRows: [task("carry-over", { periodRelation: "CARRY_OVER" })],
    nextRows: [task("carry-over", { period: { start: "2026-10-09", end: "2026-10-16" } })],
  });
  assert.equal(result.ok, true);
});

test("rejects duplicate task IDs within next rows", () => {
  const result = validatePersonalWeeklyDraft({
    nextRows: [
      task("same", { period: { start: "2026-10-09", end: "2026-10-16" } }),
      task("same", { period: { start: "2026-10-09", end: "2026-10-16" } }),
    ],
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /duplicate/i);
});

test("rejects current rows without a task ID", () => {
  const result = validatePersonalWeeklyDraft({ currentRows: [{ title: "Missing ID" }] });
  assert.equal(result.ok, false);
  assert.match(result.message, /task.?id|required|invalid/i);
});

test("rejects next rows without a task ID", () => {
  const result = validatePersonalWeeklyDraft({ nextRows: [{ title: "Missing ID", period: { start: "2026-10-09", end: "2026-10-16" } }] });
  assert.equal(result.ok, false);
  assert.match(result.message, /task.?id|required|invalid/i);
});

test("rejects oversized draft row arrays", () => {
  const result = validatePersonalWeeklyDraft({ currentRows: Array.from({ length: 201 }, (_, i) => task(`task-${i}`)) });
  assert.equal(result.ok, false);
  assert.match(result.message, /maximum|too many|limit/i);
});

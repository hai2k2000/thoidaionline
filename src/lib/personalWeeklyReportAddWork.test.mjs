import assert from "node:assert/strict";
import test from "node:test";

import {
  filterPersonalWeeklyAddableRows,
  validatePersonalWeeklyCurrentRows,
} from "./personalWeeklyReport.ts";

const row = (taskId, overrides = {}) => ({
  taskId,
  title: `Task ${taskId}`,
  status: "in_progress",
  source: "assigned",
  sourceLabel: "Công việc được giao",
  sourceLabels: ["Công việc được giao"],
  ...overrides,
});

test("B/C: addable rows exclude selected and duplicate canonical task IDs", () => {
  const result = filterPersonalWeeklyAddableRows([
    row("task-a"),
    row("task-b"),
    row("task-b", { source: "department_plan" }),
  ], ["task-a"]);
  assert.deepEqual(result.map((item) => item.taskId), ["task-b"]);
});

test("task candidates fail closed for cancelled or explicitly ineligible rows", () => {
  const result = filterPersonalWeeklyAddableRows([
    row("active"),
    row("cancelled", { status: "cancelled" }),
    row("watcher", { selectableForWeeklyReport: false }),
  ], []);
  assert.deepEqual(result.map((item) => item.taskId), ["active"]);
});

test("server allow-list preserves canonical fields and accepts report-only commentary", () => {
  const canonical = row("task-a", { title: "Canonical title", status: "done", workflowType: "REPORT_ONLY", source: "report_only", sourceLabel: "Việc phát sinh", sourceLabels: ["Việc phát sinh"] });
  const result = validatePersonalWeeklyCurrentRows([
    row("task-a", { title: "Injected title", status: "cancelled", resultText: "Đã hoàn thành", commentary: "Ghi chú tuần" }),
  ], [canonical]);
  assert.equal(result.ok, true);
  assert.equal(result.value[0].title, "Canonical title");
  assert.equal(result.value[0].status, "done");
  assert.equal(result.value[0].workflowType, "REPORT_ONLY");
  assert.equal(result.value[0].resultText, "Đã hoàn thành");
  assert.equal(result.value[0].commentary, "Ghi chú tuần");
});

test("D: server allow-list rejects another employee task ID", () => {
  const result = validatePersonalWeeklyCurrentRows([row("other-user-task")], [row("own-task")]);
  assert.equal(result.ok, false);
  assert.match(result.message, /not eligible|scope/i);
});

test("G: an intentionally removed optional task stays absent from the validated draft", () => {
  const result = validatePersonalWeeklyCurrentRows([row("kept")], [row("kept"), row("removed")]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.map((item) => item.taskId), ["kept"]);
});

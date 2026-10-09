import assert from "node:assert/strict";
import test from "node:test";
import { completionDateFromTaskTimestamp } from "./businessDate.mjs";

import {
  DEFAULT_PERSONAL_QUICK_REPORT_PAGE_SIZE,
  filterPersonalQuickReports,
  personalQuickReportMetrics,
  personalQuickReportPeriodBounds,
} from "./quickReportPersonalSummary.ts";

const row = (overrides = {}) => ({
  id: "task-1",
  title: "Hoàn thiện hướng dẫn phần mềm",
  description: "Cập nhật tài liệu",
  report_work_date: "2026-10-12",
  start_date: "2026-10-12",
  completion_date: "2026-10-12",
  report_notes: "Đã hoàn thành",
  status: "done",
  workflow_type: "REPORT_ONLY",
  owner_id: "employee-a",
  created_by: "employee-a",
  ...overrides,
});

test("personal summary defaults to a bounded page size", () => {
  assert.equal(DEFAULT_PERSONAL_QUICK_REPORT_PAGE_SIZE, 50);
});

test("month and custom range use the canonical report work date", () => {
  assert.deepEqual(personalQuickReportPeriodBounds("month", "2026-10-12"), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(personalQuickReportPeriodBounds("range", "2026-10-03", "2026-10-09"), { from: "2026-10-03", to: "2026-10-09" });
});

test("summary filters only REPORT_ONLY rows owned by the actor", () => {
  const result = filterPersonalQuickReports([row(), row({ id: "task-2", owner_id: "employee-b" }), row({ id: "task-3", workflow_type: "STANDARD" })], "employee-a", { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(result.map((item) => item.id), ["task-1"]);
});

test("summary metrics use canonical task statuses", () => {
  assert.deepEqual(personalQuickReportMetrics([row({ status: "done" }), row({ id: "task-2", status: "in_progress" }), row({ id: "task-3", status: "cancelled" })]), { total: 3, completed: 1, inProgress: 1, unfinished: 2 });
});


test("summary completion date uses Vietnam business date from completed timestamp", () => {
  assert.equal(completionDateFromTaskTimestamp("2026-09-30T17:00:00.000Z"), "2026-10-01");
  assert.equal(completionDateFromTaskTimestamp(null), null);
});

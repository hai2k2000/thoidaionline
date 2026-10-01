import assert from "node:assert/strict";
import test from "node:test";

import {
  QUICK_REPORT_CATEGORIES,
  REPORT_ONLY_WORKFLOW,
  STANDARD_WORKFLOW,
  normalizeQuickReportBatch,
  normalizeQuickReportRow,
  validateQuickReportTimeRange,
} from "./quickReportContract.mjs";

const row = (overrides = {}) => ({
  title: "Sửa máy in phòng Nội dung",
  category: "printer_device",
  workDate: "2026-10-01",
  startedTime: "09:15",
  completedTime: "09:30",
  status: "done",
  notes: "Đã thay hộp mực",
  ...overrides,
});

test("quick report uses explicit workflow and reusable categories", () => {
  assert.equal(STANDARD_WORKFLOW, "STANDARD");
  assert.equal(REPORT_ONLY_WORKFLOW, "REPORT_ONLY");
  assert.deepEqual(QUICK_REPORT_CATEGORIES, ["computer", "network", "printer_device", "facilities", "official_document", "administration", "other"]);
});

test("single quick report normalizes a completed row without reviewer fields", () => {
  assert.deepEqual(normalizeQuickReportRow(row()), row());
  assert.equal(validateQuickReportTimeRange("09:15", "09:30"), null);
});

test("in-progress quick report may omit completion time", () => {
  const normalized = normalizeQuickReportRow(row({ status: "in_progress", completedTime: "" }));
  assert.equal(normalized.completedTime, null);
  assert.equal(validateQuickReportTimeRange(normalized.startedTime, normalized.completedTime), null);
});

test("quick report rejects invalid row values and reversed times", () => {
  assert.throws(() => normalizeQuickReportRow(row({ category: "regular" })), /category/);
  assert.throws(() => normalizeQuickReportRow(row({ status: "done", completedTime: "" })), /completedTime/);
  assert.throws(() => normalizeQuickReportRow(row({ startedTime: "18:00", completedTime: "17:00" })), /completedTime/);
  assert.throws(() => normalizeQuickReportRow(row({ startedTime: "9:15" })), /startedTime/);
});

test("batch validation is bounded at 50 and preserves row indexes", () => {
  const batch = normalizeQuickReportBatch([row(), row({ title: "Xử lý mất mạng tầng 3" })]);
  assert.equal(batch.length, 2);
  assert.throws(() => normalizeQuickReportBatch([]), /1-50/);
  assert.throws(() => normalizeQuickReportBatch(Array.from({ length: 51 }, () => row())), /1-50/);
  assert.throws(() => normalizeQuickReportBatch([row(), row({ title: "" })]), /row 2/);
});

test("server-owned self-report fields cannot be supplied by the client", () => {
  assert.throws(() => normalizeQuickReportRow(row({ workflowType: "STANDARD", creatorId: "other", ownerId: "other" })), /workflowType|creatorId|ownerId/);
});

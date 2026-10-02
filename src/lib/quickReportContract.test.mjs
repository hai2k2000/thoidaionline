import assert from "node:assert/strict";
import test from "node:test";

import {
  QUICK_REPORT_CATEGORIES,
  REPORT_ONLY_WORKFLOW,
  STANDARD_WORKFLOW,
  normalizeQuickReportBatch,
  normalizeQuickReportRow,
} from "./quickReportContract.mjs";

const row = (overrides = {}) => ({
  title: "Sửa máy in phòng Nội dung",
  category: "printer_device",
  startDate: "2026-10-01",
  completionDate: "2026-10-01",
  status: "done",
  notes: "Đã thay hộp mực",
  ...overrides,
});

test("quick report uses explicit workflow and reusable categories", () => {
  assert.equal(STANDARD_WORKFLOW, "STANDARD");
  assert.equal(REPORT_ONLY_WORKFLOW, "REPORT_ONLY");
  assert.deepEqual(QUICK_REPORT_CATEGORIES, ["computer", "network", "printer_device", "facilities", "official_document", "administration", "other"]);
});

test("single quick report normalizes date-only completion without reviewer fields", () => {
  assert.deepEqual(normalizeQuickReportRow(row()), row());
  assert.equal(normalizeQuickReportRow(row()).startDate, "2026-10-01");
});

test("in-progress quick report may omit completion date", () => {
  const normalized = normalizeQuickReportRow(row({ status: "in_progress", completionDate: "" }));
  assert.equal(normalized.completionDate, null);
});

test("quick report rejects invalid row values and reversed dates", () => {
  assert.throws(() => normalizeQuickReportRow(row({ category: "regular" })), /category/);
  assert.throws(() => normalizeQuickReportRow(row({ status: "done", completionDate: "" })), /completionDate/);
  assert.throws(() => normalizeQuickReportRow(row({ startDate: "2026-10-02", completionDate: "2026-10-01" })), /completionDate/);
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

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAttendanceExportSheet, buildAttendanceExportXlsx, exportDayHeader, exportTitle } from "./attendanceExport.mjs";

const october = Array.from({ length: 31 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
const cells = october.map((date) => ({
  date,
  code: date === "2026-10-03" ? "weekend" : date === "2026-10-05" ? "absent" : date === "2026-10-06" ? "forgot_card" : "present",
  symbol: date === "2026-10-03" ? "·" : date === "2026-10-05" ? "✗" : date === "2026-10-06" ? "QT" : "✓",
  workday: date === "2026-10-03" || date === "2026-10-05" ? 0 : 1,
}));
const grid = { days: october, rows: [{ staffId: "u1", name: "Nguyễn Văn A", departmentName: "Phòng Tổng hợp & Tin", cells, totalWorkday: 29 }] };
const monthlyRows = [
  { user_id: "u1", work_date: "2026-10-01", note: "Đi muộn" },
  { user_id: "u1", work_date: "2026-10-02", note: "Về sớm; Thiếu giờ ra" },
];

test("day headers and title identify October 2026", () => {
  assert.equal(exportDayHeader("2026-10-01"), "01");
  assert.equal(exportTitle("2026-10"), "BẢNG CHẤM CÔNG THÁNG 10/2026");
});

test("export sheet mirrors all calendar days and grid symbols", () => {
  const sheet = buildAttendanceExportSheet("2026-10", grid, monthlyRows);
  assert.equal(sheet.columns.length, 42);
  assert.deepEqual(sheet.rows[2].cells.slice(3, 34).map((cell) => cell.value), october.map(exportDayHeader));
  assert.deepEqual(sheet.rows[3].cells.slice(3, 10).map((cell) => cell.value), ["T5", "T6", "T7", "CN", "T2", "T3", "T4"]);
  const data = sheet.rows[4].cells;
  assert.equal(data[1].value, "Nguyễn Văn A");
  assert.equal(data[2].value, "Phòng Tổng hợp & Tin");
  assert.equal(data[5].value, "·");
  assert.equal(data[7].value, "✗");
  assert.equal(data[8].value, "QT");
  assert.equal(typeof data[34].value, "number");
  assert.doesNotMatch(JSON.stringify(data), /[0-9a-f]{8}-[0-9a-f]{4}-/);
});

test("attendance export builds a real xlsx buffer", () => {
  const output = buildAttendanceExportXlsx("2026-10", grid, monthlyRows);
  assert.ok(Buffer.isBuffer(output));
  assert.equal(output.subarray(0, 2).toString(), "PK");
});

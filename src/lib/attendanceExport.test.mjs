import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAttendanceExportCsv, exportCellValue, exportDayHeader, exportTitle, exportWorkdays } from "./attendanceExport.mjs";

const october = Array.from({ length: 31 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);

test("day headers show only the day of month", () => {
  assert.equal(exportDayHeader("2026-10-01"), "01");
  assert.equal(exportDayHeader("2026-10-05"), "05");
});

test("title names the month", () => {
  assert.equal(exportTitle("2026-10"), "BẢNG CHẤM CÔNG THÁNG 10/2026");
});

test("export keeps the 22 weekdays of October 2026", () => {
  assert.equal(exportWorkdays("2026-10", october).length, 22);
});

test("cells follow the grid status codes", () => {
  assert.equal(exportCellValue({ code: "present", workday: 1 }), 1);
  assert.equal(exportCellValue({ code: "incomplete", workday: 0 }), 0);
  assert.equal(exportCellValue({ code: "absent", workday: 0 }), 0);
  assert.equal(exportCellValue({ code: "leave_full", workday: 1 }), "P");
  assert.equal(exportCellValue({ code: "leave_half", workday: 0.5 }), "½P");
  assert.equal(exportCellValue({ code: "business", workday: 1 }), "CT");
  assert.equal(exportCellValue({ code: "online", workday: 1 }), "O");
  assert.equal(exportCellValue({ code: "future", workday: 0 }), "");
  assert.equal(exportCellValue(undefined), "");
});

test("CSV uses the department name, not its id, and fills past absences", () => {
  const cells = october.map((date) => ({ date, code: date === "2026-10-02" ? "absent" : date === "2026-10-05" ? "business" : "present", workday: date === "2026-10-02" ? 0 : 1 }));
  const csv = buildAttendanceExportCsv("2026-10", { days: october, rows: [{ staffId: "u1", name: "Nguyễn Văn A", departmentName: "Phòng Tổng hợp", cells }] }, [{ user_id: "u1", work_date: "2026-10-01", note: "Đi muộn" }]);
  assert.ok(csv.startsWith("﻿"));
  const [title, blank, header, row] = csv.slice(1).trim().split("\n");
  assert.equal(title, "BẢNG CHẤM CÔNG THÁNG 10/2026");
  assert.equal(blank, "");
  assert.ok(header.startsWith("STT,Họ tên,Phòng,01,02,05,06"));
  const fields = row.split(",");
  assert.equal(fields[2], "Phòng Tổng hợp");
  assert.equal(fields[4], "0");
  assert.equal(fields[5], "CT");
  assert.doesNotMatch(row, /[0-9a-f]{8}-[0-9a-f]{4}-/);
  const tail = fields.slice(-7);
  assert.deepEqual(tail, ["21", "0", "1", "1", "1", "0", "0"]);
});

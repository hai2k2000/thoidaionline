import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAttendanceExportCsv, exportCellValue, exportDayHeader, exportWorkdays } from "./attendanceExport.mjs";

const october = Array.from({ length: 31 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);

test("day headers carry the weekday so Excel keeps them as text", () => {
  assert.equal(exportDayHeader("2026-10-01"), "T5 01/10");
  assert.equal(exportDayHeader("2026-10-05"), "T2 05/10");
  assert.doesNotMatch(exportDayHeader("2026-10-01"), /^\d{2}\/\d{2}$/);
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
  const [header, row] = csv.slice(1).trim().split("\n");
  assert.ok(header.startsWith("STT,Họ tên,Phòng,T5 01/10,T6 02/10,T2 05/10"));
  const fields = row.split(",");
  assert.equal(fields[2], "Phòng Tổng hợp");
  assert.equal(fields[4], "0");
  assert.equal(fields[5], "CT");
  assert.doesNotMatch(row, /[0-9a-f]{8}-[0-9a-f]{4}-/);
  const tail = fields.slice(-7);
  assert.deepEqual(tail, ["21", "0", "1", "1", "1", "0", "0"]);
});

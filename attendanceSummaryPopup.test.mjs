import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("src/app/attendance/page.tsx", "utf8");
const { attendanceDetailsForEmployee } = await import("./src/lib/attendanceSummaryDetails.mjs");

test("summary row opens a popup with only the selected employee's attendance details", () => {
  const rows = [
    { user_id: "u1", work_date: "2026-09-02", check_in: "07:55", check_out: "17:05", note: "", status: "present" },
    { user_id: "u2", work_date: "2026-09-02", check_in: "08:00", check_out: "17:00", note: "", status: "present" },
    { user_id: "u1", work_date: "2026-09-05", check_in: null, check_out: null, note: "Làm việc online", status: "present" },
  ];
  assert.deepEqual(attendanceDetailsForEmployee(rows, "u1", "2026-09-01", "2026-09-03"), [rows[0]]);
  assert.deepEqual(attendanceDetailsForEmployee(rows, "u1", "2026-09-01", "2026-09-30"), [rows[0], rows[2]]);
  assert.match(page, /selectedSummaryEmployee/);
  assert.match(page, /role="dialog"/);
  assert.match(page, /Chi tiết chấm công/);
  assert.match(page, /className="border-t cursor-pointer" onClick=\{\(\) => setSelectedSummaryEmployee/);
  assert.match(page, /onClick=\{\(\) => setSelectedSummaryEmployee/);
  assert.match(page, /event\.target === event\.currentTarget/);
  assert.match(page, /window\.addEventListener\("keydown", closeOnEscape\)/);
  assert.match(page, /onClick=\{\(event\) => \{ if \(event\.target === event\.currentTarget\) setSelectedSummaryEmployee\(null\)/);
});

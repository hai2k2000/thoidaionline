import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { attendanceGridDays } from "./attendanceGridRange.mjs";

const route = readFileSync(new URL("../app/api/attendance/route.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/attendance/page.tsx", import.meta.url), "utf8");
const grid = readFileSync(new URL("../components/attendance/AttendanceMonthGrid.tsx", import.meta.url), "utf8");

test("attendance API builds organization grids for every period", () => {
  assert.match(route, /const gridDays = organizationScope/);
  assert.match(route, /const grid = organizationScope/);
  assert.match(route, /gridDays\.map\(\(workDate\)/);
});

test("attendance grid range has one, seven, and month-length days", () => {
  assert.equal(attendanceGridDays("2026-10-28", "2026-10-28").length, 1);
  assert.equal(attendanceGridDays("2026-10-26", "2026-11-01").length, 7);
  assert.equal(attendanceGridDays("2026-10-01", "2026-10-31").length, 31);
});

test("attendance page exposes grid toggle for every period", () => {
  assert.doesNotMatch(page, /isOrganizationView && period === "month" \? <div/);
  assert.match(page, /isOrganizationView \? <div className="mt-3 flex gap-2"/);
});

test("attendance grid cells open the staff day popup", () => {
  assert.match(grid, /onClick=\{\(\) => onCellClick\?\.\(row\.staffId, cell\.date\)\}/);
});

test("day and week grid headers show weekday and dd/mm", () => {
  assert.match(grid, /`\$\{weekday\} \$\{day\.slice\(-2\)\}\/\$\{day\.slice\(5, 7\)\}`/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("src/app/attendance/page.tsx", "utf8");

test("attendance table exposes Ngày using dd/mm/yyyy formatting", () => {
  assert.match(page, /formatAttendanceDate/);
  assert.doesNotMatch(page, /period !== "day" \? <th/);
  assert.match(page, /\$\{day\}\/\$\{month\}\/\$\{year\}/);
  assert.match(page, /formatAttendanceDate\(r\.work_date\)/);
  assert.match(page, /colSpan=\{6\}/);
  const dayTable = page.match(/attendance-day-table[\s\S]*?<\/table>/)?.[0] ?? "";
  assert.doesNotMatch(dayTable, /Ngày công/);
});

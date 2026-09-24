import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("src/app/attendance/page.tsx", "utf8");

test("attendance table exposes Ngày using dd/mm/yyyy formatting", () => {
  assert.match(page, /formatAttendanceDate/);
  assert.match(page, /<th scope="col" className="px-3 py-2">Ngày<\/th>/);
  assert.match(page, /\$\{day\}\/\$\{month\}\/\$\{year\}/);
  assert.match(page, /formatAttendanceDate\(r\.work_date\)/);
  assert.match(page, /colSpan=\{7\}/);
});

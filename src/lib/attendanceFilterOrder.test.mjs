import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/attendance/page.tsx", import.meta.url), "utf8");

test("attendance filter bar puts department before staff", () => {
  const filterBar = page.match(/isOrganizationView \? <div className="mt-3[\s\S]*?<\/div> : null/);
  assert.ok(filterBar);
  assert.ok(filterBar[0].indexOf("Phòng ban") < filterBar[0].indexOf("Nhân viên"));
});

test("attendance datalist options are filtered by the selected department", () => {
  assert.match(page, /filterOptions\.staff\.filter\(\(item\) => !departmentFilter \|\| item\.department_id === departmentFilter\)/);
});

test("changing department clears an out-of-department staff selection", () => {
  assert.match(page, /const nextStaff = filterOptions\.staff\.find\(\(item\) => item\.id === staffFilter\)/);
  assert.match(page, /nextStaff\.department_id !== nextDepartment/);
  assert.match(page, /setStaffFilter\(""\); setStaffQuery\(""\);[\s\S]*?updateQuery\(\{ staffId: "", departmentId: nextDepartment \}\)/);
});

test("attendance requests use a sequence guard", () => {
  assert.match(page, /useRef<number>\(0\)/);
  assert.match(page, /const requestSequence = \+\+attendanceRequestSequence\.current/);
  assert.match(page, /if \(requestSequence !== attendanceRequestSequence\.current\) return/);
});

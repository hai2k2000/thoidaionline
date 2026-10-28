import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/attendance/route.ts", import.meta.url), "utf8");

// Filter choices must not shrink after a filter is applied, but grid rows must still honour the filters.
test("filter options use the scope-wide staff list while the grid uses filtered staff", () => {
  assert.match(route, /const optionStaff = staffRows;/);
  assert.match(route, /staff: optionStaff\.map\(/);
  assert.match(route, /const visibleStaff = staffRows\.filter\(\(staff\) => \(!staffId \|\| staff\.id === staffId\) && \(!departmentId \|\| staff\.department_id === departmentId\)\)/);
  assert.match(route, /rows: visibleStaff\.map\(/);
});

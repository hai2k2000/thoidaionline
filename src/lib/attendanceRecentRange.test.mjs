import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { recentAttendanceDates, clampAttendanceEndDate } from "./attendanceRecentRange.mjs";

test("default attendance range contains exactly the latest ten Vietnam dates", () => {
  assert.deepEqual(recentAttendanceDates("2026-09-30", 0, 10), [
    "2026-09-30", "2026-09-29", "2026-09-28", "2026-09-27", "2026-09-26",
    "2026-09-25", "2026-09-24", "2026-09-23", "2026-09-22", "2026-09-21",
  ]);
});

test("load more extends older dates without including a future date", () => {
  const dates = recentAttendanceDates("2026-01-02", 10, 10);
  assert.equal(dates[0], "2025-12-23");
  assert.equal(dates.at(-1), "2025-12-14");
  assert.ok(dates.every((date) => date <= "2026-01-02"));
});

test("future requested end is clamped to Vietnam today", () => {
  assert.equal(clampAttendanceEndDate("2026-10-05", "2026-09-30"), "2026-09-30");
  assert.equal(clampAttendanceEndDate("2026-09-29", "2026-09-30"), "2026-09-29");
});

test("weekend dates are not default attendance workdays", () => {
  const route = readFileSync(new URL("../app/api/attendance/route.ts", import.meta.url), "utf8");
  assert.match(route, /const dayOfWeek = new Date\(`\$\{workDate\}T12:00:00Z`\)\.getUTCDay\(\);/);
  assert.match(route, /if \(dayOfWeek === 0 \|\| dayOfWeek === 6\) continue;/);
});

test("attendance API fills absent rows and UI defaults to ten recent days", () => {
  const route = readFileSync(new URL("../app/api/attendance/route.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/attendance/page.tsx", import.meta.url), "utf8");
  assert.match(route, /status: "absent"/);
  assert.match(route, /note: "Vắng"/);
  assert.match(page, /limit=10/);
  assert.match(page, /Tải thêm 10 ngày cũ hơn/);
  assert.match(page, /max=\{today\}/);
});

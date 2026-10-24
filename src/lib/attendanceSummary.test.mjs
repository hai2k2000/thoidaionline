import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("src/app/attendance/page.tsx", "utf8");
const route = readFileSync("src/app/api/attendance/route.ts", "utf8");
const summary = page.slice(page.indexOf("const monthlySummary"), page.indexOf("const leaveFormDays"));
const table = page.slice(page.indexOf('<h2 className="mb-2 text-lg font-semibold">Tổng công'), page.indexOf("</section>", page.indexOf('<h2 className="mb-2 text-lg font-semibold">Tổng công')));

test("attendance total summary exposes work and leave-day counts", () => {
  assert.match(summary, /daysPresent/);
  assert.match(summary, /leaveWithPermission/);
  assert.match(summary, /leaveWithoutPermission/);
  assert.match(summary, /businessDays/);
  assert.doesNotMatch(summary, /totalHours|workUnits/);
  assert.doesNotMatch(table, /Tổng giờ làm|Công quy đổi/);
});

test("business leave is classified as business only and synthetic rows do not become unexcused absence", () => {
  assert.match(summary, /if \(r\.attendance_sources\?\.business\) current\.businessDays\.add/);
  assert.match(summary, /r\.has_attendance_log !== false && r\.status === "absent"/);
  assert.match(route, /leave\.leave_type === "business" \? "present" : "leave"/);
  assert.match(route, /leave\.leave_type === "business" \? \{ business: true \} : \{ leave: true \}/);
  assert.match(route, /status: "admin_note"/);
  assert.match(route, /row\.has_attendance_log !== false\) continue/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("src/app/api/leave-requests/route.ts", "utf8");
const attendance = readFileSync("src/app/api/attendance/route.ts", "utf8");
const complete = readFileSync("src/app/api/attendance/sync/complete/route.ts", "utf8");
const realtime = readFileSync("src/app/api/attendance/sync/realtime/route.ts", "utf8");
const page = readFileSync("src/app/attendance/page.tsx", "utf8");
const migration = readFileSync("supabase/migrations/20260910090000_leave_requests.sql", "utf8");
const longLeaveMigration = readFileSync("supabase/migrations/20260910150000_long_leave_tbt_approval.sql", "utf8");
const leaveFilterSource = readFileSync("src/lib/leaveRequestFilters.mjs", "utf8");
const leaveFilters = await import("./src/lib/leaveRequestFilters.mjs");

test("leave workflow is authenticated, approved by leadership, and conflict-safe", () => {
  assert.match(route, /requireReadActor/);
  assert.match(route, /requireMutationActor/);
  assert.match(route, /api_create_leave_request/);
  assert.match(route, /api_review_leave_request/);
  assert.match(route, /api_cancel_leave_request/);
  assert.match(migration, /overlapping leave request/);
  assert.match(migration, /status in \('pending','approved','rejected','cancelled'\)/);
  assert.match(route, /requiresTbtApproval/);
  assert.match(route, /guard\.actor\.role_code !== TBT_ROLE/);
  assert.match(page, /leaveDurationDays/);
  assert.match(page, /Đơn nghỉ hoặc công tác từ 3 ngày trở lên bắt buộc Tổng biên tập phê duyệt/);
  assert.match(page, /min=\{leaveForm\.startDate\}/);
  assert.match(longLeaveMigration, /v_days >= 3/);
  assert.match(longLeaveMigration, /<> 'tong_bien_tap'/);
});

test("attendance notes combine approved leave and online work and remain blank otherwise", () => {
  assert.match(attendance, /leave_requests/);
  assert.match(attendance, /online_work_schedules/);
  assert.match(attendance, /Làm việc online/);
  assert.match(attendance, /parts\.join\("; "\)/);
  assert.doesNotMatch(attendance, /row\.note\?\.replace/);
  assert.match(attendance, /onlineRow\.work_date < from \|\| onlineRow\.work_date > to/);
  assert.match(attendance, /const aLastPunch = a\.check_out \?\? a\.check_in/);
  assert.match(attendance, /bLastPunch\.localeCompare\(aLastPunch\)/);
  assert.match(page, /document\.visibilityState !== "visible"/);
  assert.match(page, /}, 5000\)/);
  assert.match(complete, /earliest: Date; latest: Date/);
  assert.match(complete, /instant\.getTime\(\) < current\.earliest\.getTime\(\)/);
  assert.match(complete, /instant\.getTime\(\) > current\.latest\.getTime\(\)/);
  assert.match(realtime, /\.eq\("device_id", deviceId\)/);
  assert.match(realtime, /sort\(\(a, b\) => a\.getTime\(\) - b\.getTime\(\)\)/);
  assert.match(page, /Gửi đơn nghỉ \/ công tác/);
  assert.match(page, /Duyệt đơn nghỉ \/ công tác/);
  assert.match(page, /Đơn nghỉ \/ công tác của tôi/);
  assert.match(page, /Quản lý đơn nghỉ \/ công tác/);
  assert.match(route, /const from = params\.get\("from"\)/);
  assert.match(route, /management = result\.data/);
  assert.match(page, /r\.note \?\? ""/);
});

test("employee leave history has independent month and status filters", () => {
  const defaults = leaveFilters.defaultLeaveRequestFilters(new Date(2026, 8, 15));
  assert.deepEqual(defaults, { timeScope: "month", month: "2026-09", status: "all" });
  assert.deepEqual(leaveFilters.monthRange("2026-09"), { start: "2026-09-01", end: "2026-09-30" });
  assert.deepEqual(leaveFilters.parseMineLeaveFilters(new URLSearchParams("mineScope=month&mineFrom=2026-09-01&mineTo=2026-09-30&mineStatus=approved"), "2026-09-01", "2026-09-30"), { from: "2026-09-01", to: "2026-09-30", status: "approved" });
  assert.deepEqual(leaveFilters.parseMineLeaveFilters(new URLSearchParams("mineScope=all&mineStatus=all"), "2026-09-01", "2026-09-30"), { from: null, to: null, status: "all" });
  assert.equal(leaveFilters.parseMineLeaveFilters(new URLSearchParams("mineScope=month&mineStatus=unknown"), "2026-09-01", "2026-09-30"), null);
  assert.match(route, /parseMineLeaveFilters/);
  assert.match(leaveFilterSource, /mineScope/);
  assert.match(leaveFilterSource, /mineFrom/);
  assert.match(leaveFilterSource, /mineTo/);
  assert.match(leaveFilterSource, /mineStatus/);
  assert.match(page, /leaveMonth/);
  assert.match(page, /leaveStatus/);
  assert.match(page, /leaveTimeScope/);
  assert.match(page, /type="month"/);
  assert.match(page, /Tất cả thời gian/);
  assert.match(page, /Tất cả trạng thái/);
  assert.match(page, /Đơn nghỉ \/ công tác của tôi/);
});

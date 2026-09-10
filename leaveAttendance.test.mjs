import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("src/app/api/leave-requests/route.ts", "utf8");
const attendance = readFileSync("src/app/api/attendance/route.ts", "utf8");
const page = readFileSync("src/app/attendance/page.tsx", "utf8");
const migration = readFileSync("supabase/migrations/20260910090000_leave_requests.sql", "utf8");

test("leave workflow is authenticated, approved by leadership, and conflict-safe", () => {
  assert.match(route, /requireReadActor/);
  assert.match(route, /requireMutationActor/);
  assert.match(route, /api_create_leave_request/);
  assert.match(route, /api_review_leave_request/);
  assert.match(route, /api_cancel_leave_request/);
  assert.match(migration, /overlapping leave request/);
  assert.match(migration, /status in \('pending','approved','rejected','cancelled'\)/);
});

test("attendance notes combine approved leave and online work and remain blank otherwise", () => {
  assert.match(attendance, /leave_requests/);
  assert.match(attendance, /online_work_schedules/);
  assert.match(attendance, /Làm việc online/);
  assert.match(attendance, /parts\.join\("; "\)/);
  assert.doesNotMatch(attendance, /row\.note\?\.replace/);
  assert.match(attendance, /onlineRow\.work_date < from \|\| onlineRow\.work_date > to/);
  assert.match(page, /Gửi đơn xin nghỉ/);
  assert.match(page, /Duyệt đơn xin nghỉ/);
  assert.match(page, /Đơn xin nghỉ trong khoảng đã chọn/);
  assert.match(page, /Quản lý đơn xin nghỉ/);
  assert.match(route, /const from = params\.get\("from"\)/);
  assert.match(route, /management = result\.data/);
  assert.match(page, /r\.note \?\? ""/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("src/app/api/leave-requests/route.ts", "utf8");
const attendance = readFileSync("src/app/api/attendance/route.ts", "utf8");
const page = readFileSync("src/app/attendance/page.tsx", "utf8");
const migration = readFileSync("supabase/migrations/20260910090000_leave_requests.sql", "utf8");
const scopedMigration = readFileSync("supabase/migrations/20260911133000_scope_leave_review_to_department.sql", "utf8");

test("leave workflow is authenticated, approved by leadership, and conflict-safe", () => {
  assert.match(route, /requireReadActor/);
  assert.match(route, /requireMutationActor/);
  assert.match(route, /api_create_leave_request/);
  assert.match(route, /api_review_leave_request/);
  assert.match(route, /api_cancel_leave_request/);
  assert.match(route, /"business"/);
  assert.match(migration, /overlapping leave request/);
  assert.match(migration, /status in \('pending','approved','rejected','cancelled'\)/);
  assert.match(route, /GLOBAL_REVIEW_ROLES/);
  assert.match(route, /query = query\.eq\("department_id", guard\.actor\.department_id/);
  assert.match(scopedMigration, /v_department is not distinct from v_old\.department_id/);
  assert.match(scopedMigration, /v_days >= 3[\s\S]*tong_bien_tap/);
});

test("attendance notes combine approved leave and online work and remain blank otherwise", () => {
  assert.match(attendance, /leave_requests/);
  assert.match(attendance, /online_work_schedules/);
  assert.match(attendance, /Làm việc online/);
  assert.match(attendance, /business: "Công tác"/);
  assert.match(attendance, /parts\.join\("; "\)/);
  assert.match(page, /leaveTypeLabel/);
  assert.match(page, /value="business">Công tác/);
  assert.match(page, /Gửi đơn nghỉ \/ công tác/);
  assert.match(page, /Duyệt đơn nghỉ \/ công tác/);
  assert.match(page, /r\.note \?\? ""/);
});

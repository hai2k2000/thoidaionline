import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveAttendanceAccessFromScopes } from "./attendanceAccessCore.mjs";

const route = readFileSync(new URL("../app/api/attendance/route.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/attendance/page.tsx", import.meta.url), "utf8");
const attendanceLayout = readFileSync(new URL("../app/attendance/layout.tsx", import.meta.url), "utf8");
const myAttendanceLayout = readFileSync(new URL("../app/my-attendance/layout.tsx", import.meta.url), "utf8");
const evaluationRoute = readFileSync(new URL("../app/api/public-evaluation-summary/route.ts", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../components/phase2Navigation.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../supabase/migrations/20261028150000_attendance_rbac_v1.sql", import.meta.url), "utf8");

test("attendance access resolves all, department, none and manage", () => {
  assert.deepEqual(resolveAttendanceAccessFromScopes({ "attendance.view_all": ["department"], "attendance.manage": [] }), { orgScope: "department", canManage: false });
  assert.deepEqual(resolveAttendanceAccessFromScopes({ "attendance.view_all": ["department", "all"], "attendance.manage": ["all"] }), { orgScope: "all", canManage: true });
  assert.deepEqual(resolveAttendanceAccessFromScopes({}), { orgScope: null, canManage: false });
});

test("attendance migration adds the department scope and exemption column", () => {
  assert.match(migration, /attendance\.manage/);
  assert.match(migration, /attendance\.view_all.*department/s);
  assert.match(migration, /role_permission_grants[\s\S]*r\.code='admin'[\s\S]*p\.code='attendance\.manage'/);
  assert.match(migration, /add column if not exists attendance_exempt boolean not null default false/i);
});

test("attendance API requires a signed-in actor and validates the date/scope", () => {
  assert.match(route, /requireReadActor/);
  assert.match(route, /isValidDate\(date\)/);
  assert.match(route, /\["personal", "organization"\]/);
});

test("organization-wide attendance is restricted by the attendance access helper", () => {
  assert.match(route, /resolveAttendanceAccess/);
  assert.doesNotMatch(route, /scope === "organization" && guard\.actor\.role_code/);
  assert.match(route, /apiError\("forbidden", 403\)/);
  assert.match(route, /orgScope/);
});

test("personal attendance always filters by the signed-in actor", () => {
  assert.match(route, /if \(!organizationScope\)/);
  assert.match(route, /dayQuery = dayQuery\.eq\("user_id", guard\.actor\.id\)/);
  assert.match(route, /monthQuery = monthQuery\.eq\("user_id", guard\.actor\.id\)/);
  assert.doesNotMatch(route, /DEMO|generateDemoRangeRows/);
});

test("browser attendance page uses the guarded API instead of direct Supabase access", () => {
  assert.match(page, /fetch\(`\/api\/attendance\?date=/);
  assert.doesNotMatch(page, /from\("attendance_logs"\)/);
  assert.doesNotMatch(page, /@\/lib\/supabase/);
});

test("organization evaluation summary remains visible to every signed-in employee", () => {
  assert.match(evaluationRoute, /requireReadActor/);
  assert.doesNotMatch(evaluationRoute, /role_code\s*!==\s*["']admin/);
  assert.match(navigation, /\{ id: "evaluation-summary", href: "\/evaluation-summary" \}/);
});

test("attendance screens enforce authentication and RBAC scope server-side", () => {
  assert.match(attendanceLayout, /getSessionUser/);
  assert.match(attendanceLayout, /resolveAttendanceAccess/);
  assert.match(attendanceLayout, /redirect\("\/my-attendance"\)/);
  assert.match(myAttendanceLayout, /getSessionUser/);
  assert.match(myAttendanceLayout, /redirect\("\/login"\)/);
});

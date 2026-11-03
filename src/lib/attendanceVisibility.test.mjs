import assert from "node:assert/strict";
import test from "node:test";
import { ATTENDANCE_EXEMPT_JOB_TITLE_CODES, isAttendanceListedStaff, isAttendanceListedUser, roleCodeFromRelation } from "./attendanceVisibility.mjs";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/attendance/route.ts", import.meta.url), "utf8");
const anomalies = readFileSync(new URL("../app/api/attendance/anomalies/route.ts", import.meta.url), "utf8");
const exportRoute = readFileSync(new URL("../app/api/attendance/export/route.ts", import.meta.url), "utf8");

test("excludes named staff and admin from organization attendance", () => {
  assert.equal(isAttendanceListedStaff({ full_name: "Đặng Quang Minh", roleCode: "employee", attendance_exempt: true }), false);
  assert.equal(isAttendanceListedStaff({ full_name: "Nguyễn Văn Linh", roleCode: "employee", attendance_exempt: true }), false);
  assert.equal(isAttendanceListedStaff({ full_name: "Nguyễn Hồng Khánh", roleCode: "employee", attendance_exempt: true }), false);
  assert.equal(isAttendanceListedStaff({ full_name: "Nhân viên khác", roleCode: "admin" }), false);
  assert.equal(isAttendanceListedStaff({ full_name: "Nhân viên khác", roleCode: "employee", attendance_exempt: false }), true);
});

test("excludes ctv job titles regardless of case or surrounding whitespace", () => {
  assert.deepEqual(ATTENDANCE_EXEMPT_JOB_TITLE_CODES, new Set(["ctv"]));
  assert.equal(isAttendanceListedStaff({ roleCode: "employee", jobTitleCode: "ctv" }), false);
  assert.equal(isAttendanceListedStaff({ roleCode: "employee", jobTitleCode: "CTV" }), false);
  assert.equal(isAttendanceListedStaff({ roleCode: "employee", jobTitleCode: " ctv " }), false);
  assert.equal(isAttendanceListedStaff({ roleCode: "employee", job_title_code: "CTV" }), false);
  assert.equal(isAttendanceListedStaff({ roleCode: "employee", job_titles: { code: " ctv " } }), false);
  assert.equal(isAttendanceListedStaff({ roleCode: "employee", job_titles: [{ code: "ctv" }] }), false);
  assert.equal(isAttendanceListedStaff({ roleCode: "employee", jobTitleCode: "other" }), true);
  assert.equal(isAttendanceListedStaff({ roleCode: "employee" }), true);
  assert.equal(isAttendanceListedStaff({ job_titles: [] }), true);
  assert.equal(isAttendanceListedStaff({ job_titles: null }), true);
  assert.equal(isAttendanceListedStaff({ roleCode: "admin", jobTitleCode: "other" }), false);
  assert.equal(isAttendanceListedStaff({ attendance_exempt: true, jobTitleCode: "other" }), false);
  assert.equal(isAttendanceListedUser({ job_titles: [{ code: "CTV" }] }), false);
});

test("every embedded attendance staff select fetches the job title code", () => {
  const embeds = [...route.matchAll(/staff_users![\w]+\(([^"\n]+)\)/g)];
  assert.equal(embeds.length, 6);
  for (const [, fields] of embeds) assert.match(fields, /job_titles\(code\)/);
  assert.match(route, /isAttendanceListedStaff\(\{ \.\.\.staff, roleCode:/);
  assert.match(route, /const filtered = result\.filter\(\(row\) => \{[\s\S]*?isAttendanceListedStaff\(\{ \.\.\.row\.staff_users,/);
  for (const source of ["admin.staff_users", "adjustment.staff_users", "leave.requester", "onlineRow.staff", "staff"]) {
    assert.ok(route.includes(`staff_users: { ...${source} }`), source);
  }
});

test("XLSX export consumes the filtered organization API grid and monthly rows", () => {
  assert.match(exportRoute, /GET as attendanceGet.*from "\.\.\/route"/);
  assert.match(exportRoute, /scope=organization/);
  assert.match(exportRoute, /await attendanceGet\(/);
  assert.match(exportRoute, /buildAttendanceExportXlsx\(month, payload\.grid/);
  assert.match(exportRoute, /payload\.monthlyRows/);
  assert.doesNotMatch(exportRoute, /from\("staff_users"\)/);
});

test("user-level filtering uses the same organization visibility rule", () => {
  assert.equal(isAttendanceListedUser({ full_name: "Đặng Quang Minh", roleCode: "employee", attendance_exempt: true }), false);
  assert.equal(isAttendanceListedUser({ full_name: "Nhân viên khác", roleCode: "employee", attendance_exempt: false }), true);
});

test("role relation supports Supabase object and array shapes", () => {
  assert.equal(roleCodeFromRelation({ code: "admin" }), "admin");
  assert.equal(roleCodeFromRelation([{ code: "admin" }]), "admin");
});

test("attendance API applies the shared visibility filter", () => {
  assert.match(route, /isAttendanceListedStaff/);
  assert.match(route, /withNotes\(items, adminNotes\)\)\.filter\(\(row(?:: AttendanceRow)?\) =>/);
  assert.match(route, /roleCodeFromRelation/);
  assert.match(route, /job_titles\(code,name\)/);
  assert.match(route, /jobTitleCode/);
  assert.match(anomalies, /job_titles\(code\)/);
  assert.match(anomalies, /jobTitleCode/);
  assert.match(exportRoute, /attendanceGet/);
});

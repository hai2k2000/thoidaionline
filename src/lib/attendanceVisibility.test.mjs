import assert from "node:assert/strict";
import test from "node:test";
import { isAttendanceListedStaff, isAttendanceListedUser, roleCodeFromRelation } from "./attendanceVisibility.mjs";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/attendance/route.ts", import.meta.url), "utf8");

test("excludes named staff and admin from organization attendance", () => {
  assert.equal(isAttendanceListedStaff({ full_name: "Đặng Quang Minh", roleCode: "employee", attendance_exempt: true }), false);
  assert.equal(isAttendanceListedStaff({ full_name: "Nguyễn Văn Linh", roleCode: "employee", attendance_exempt: true }), false);
  assert.equal(isAttendanceListedStaff({ full_name: "Nguyễn Hồng Khánh", roleCode: "employee", attendance_exempt: true }), false);
  assert.equal(isAttendanceListedStaff({ full_name: "Nhân viên khác", roleCode: "admin" }), false);
  assert.equal(isAttendanceListedStaff({ full_name: "Nhân viên khác", roleCode: "employee", attendance_exempt: false }), true);
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
});

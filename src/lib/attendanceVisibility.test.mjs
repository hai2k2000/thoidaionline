import assert from "node:assert/strict";
import test from "node:test";
import { isAttendanceListedStaff, isAttendanceListedUser } from "./attendanceVisibility.mjs";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/attendance/route.ts", import.meta.url), "utf8");

test("excludes named staff and admin from organization attendance", () => {
  assert.equal(isAttendanceListedStaff({ full_name: "Đặng Quang Minh", role_code: "employee" }), false);
  assert.equal(isAttendanceListedStaff({ full_name: "Nguyễn Văn Linh", role_code: "employee" }), false);
  assert.equal(isAttendanceListedStaff({ full_name: "Nguyễn Hồng Khánh", role_code: "employee" }), false);
  assert.equal(isAttendanceListedStaff({ full_name: "Nhân viên khác", role_code: "admin" }), false);
  assert.equal(isAttendanceListedStaff({ full_name: "Nhân viên khác", role_code: "employee" }), true);
});

test("user-level filtering uses the same organization visibility rule", () => {
  assert.equal(isAttendanceListedUser({ full_name: "Đặng Quang Minh", role_code: "employee" }), false);
  assert.equal(isAttendanceListedUser({ full_name: "Nhân viên khác", role_code: "employee" }), true);
});

test("attendance API applies the shared visibility filter", () => {
  assert.match(route, /isAttendanceListedStaff/);
  assert.match(route, /withNotes\(items\)\.filter\(\(row\) => isAttendanceListedStaff/);
});

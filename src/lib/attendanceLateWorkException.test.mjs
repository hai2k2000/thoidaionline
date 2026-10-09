import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { calculateAttendance } from "./attendanceWorkday.ts";

const route = readFileSync(new URL("../app/api/attendance/route.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/attendance/page.tsx", import.meta.url), "utf8");
const quickReportForm = readFileSync(new URL("../components/QuickReportForm.tsx", import.meta.url), "utf8");
const migrationPath = new URL("../../supabase/migrations/20261006100000_attendance_late_work_exception.sql", import.meta.url);
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
const mergeRpc = readFileSync(new URL("../../supabase/migrations/20261006100000_attendance_late_work_exception.sql", import.meta.url), "utf8");

test("late work exception keeps the real late flag but uses the separate label", () => {
  assert.deepEqual(calculateAttendance({ checkIn: "08:30", checkOut: "17:00", lateException: true, existingNote: "Đã xử lý" }), {
    workday: 1,
    late: true,
    early: false,
    note: "Đi muộn do việc phát sinh; Đã xử lý",
  });
});

test("attendance exception mutation is server-authorized and scoped to the actor", () => {
  assert.match(route, /export async function POST/);
  assert.match(route, /requireMutationActor/);
  assert.match(route, /task\.quick_report\.create/);
  assert.match(route, /late_exception/);
  assert.match(route, /eq\("user_id", guard\.actor\.id\)/);
  assert.match(route, /note\.trim\(\)/);
  assert.match(route, /row\.status === "leave"/);
  assert.match(route, /row\.status === "absent"/);
});

test("attendance UI exposes quick report and late-work exception without changing the existing leave flow", () => {
  assert.match(page, /Báo việc phát sinh/);
  assert.match(page, /task\.quick_report\.create/);
  assert.match(page, /Đi muộn do việc phát sinh/);
  assert.match(page, /api\/attendance/);
  assert.match(page, /Gửi đơn xin nghỉ/);
});

test("quick report returns to the originating attendance screen", () => {
  assert.match(page, /returnTo/);
  assert.match(quickReportForm, /useSearchParams/);
  assert.match(quickReportForm, /router\.push\(returnTo\)/);
});

test("schema persists the exception and sync preserves its note", () => {
  assert.match(migration, /add column if not exists late_exception/);
  assert.match(migration, /sudden_work/);
  assert.match(mergeRpc, /late_exception is not null/);
});
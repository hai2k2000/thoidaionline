import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { recentAttendanceDates, recentAttendanceRange } from "./attendanceRecentRange.mjs";

const route = readFileSync(new URL("../app/api/attendance/route.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/attendance/page.tsx", import.meta.url), "utf8");
const migrationPath = new URL("../../supabase/migrations/20261006120000_attendance_admin_notes.sql", import.meta.url);
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

test("recent attendance pagination returns business dates only", () => {
  assert.deepEqual(recentAttendanceDates("2026-10-12", 0, 6), [
    "2026-10-12",
    "2026-10-09",
    "2026-10-08",
    "2026-10-07",
    "2026-10-06",
    "2026-10-05",
  ]);
  assert.deepEqual(recentAttendanceRange("2026-10-12", 5, 5), {
    start: "2026-09-29",
    end: "2026-10-05",
    dates: ["2026-10-05", "2026-10-02", "2026-10-01", "2026-09-30", "2026-09-29"],
  });
});

test("migration stores admin notes separately without destructive staff cascades", () => {
  assert.match(migration, /create table if not exists public\.attendance_admin_notes/i);
  assert.match(migration, /unique\s*\(user_id, work_date\)/i);
  assert.match(migration, /char_length\(btrim\(note\)\) between 3 and 2000/i);
  assert.doesNotMatch(migration, /on delete cascade/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all privileges on table public\.attendance_admin_notes from public, anon, authenticated/i);
});

test("admin note mutation is canonical-admin-only, audited, and does not touch attendance logs", () => {
  assert.match(route, /export async function PATCH/);
  assert.match(route, /guard\.actor\.role_code !== "admin"/);
  assert.match(route, /api_upsert_attendance_admin_note/);
  assert.doesNotMatch(route, /attendance_logs[\s\S]{0,240}\.update\(\{[\s\S]{0,160}admin_note/);
  assert.match(migration, /insert into public\.audit_logs/i);
  assert.match(migration, /previous_note/i);
  assert.match(migration, /new_note/i);
});

test("attendance reads expose separate admin notes and preserve employee notes", () => {
  assert.match(route, /attendance_admin_notes/);
  assert.match(route, /staff_users!attendance_admin_notes_user_id_fkey\(full_name\)/);
  assert.match(route, /admin_note/);
  assert.match(page, /Ghi chú Admin/);
  assert.match(page, /Không có dữ liệu chấm công/);
  assert.match(page, /Sửa ghi chú|Thêm ghi chú/);
  assert.match(page, /late_exception/);
});

test("weekend filtering is applied before rows, summaries, and empty-state counts reach the UI", () => {
  assert.match(route, /isAttendanceBusinessDate/);
  assert.match(route, /filterBusinessAttendanceRows/);
  assert.match(page, /visibleAttendanceRows/);
  assert.match(page, /visibleAttendanceRows\.length/);
});


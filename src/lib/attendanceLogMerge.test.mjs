import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260911230000_atomic_attendance_log_merge.sql", "utf8");
const realtime = readFileSync("src/app/api/attendance/sync/realtime/route.ts", "utf8");
const complete = readFileSync("src/app/api/attendance/sync/complete/route.ts", "utf8");

test("attendance log merge keeps the earliest check-in and latest check-out atomically", () => {
  assert.match(migration, /on conflict \(user_id, work_date\) do update/i);
  assert.match(migration, /least\(attendance_logs\.check_in, excluded\.check_in\)/i);
  assert.match(migration, /greatest\(attendance_logs\.check_out, excluded\.check_out\)/i);
  assert.match(migration, /excluded\.check_out is null/i);
  assert.match(migration, /source <> 'wise_eye'/i);
  assert.match(migration, /status = 'leave'/i);
});

test("realtime and batch sync use the atomic attendance log merge RPC", () => {
  assert.match(realtime, /rpc\("api_merge_attendance_log"/);
  assert.match(complete, /rpc\("api_merge_attendance_log"/);
  assert.doesNotMatch(realtime, /from\("attendance_logs"\)\.upsert/);
  assert.doesNotMatch(complete, /from\("attendance_logs"\)\s*\.upsert/);
});

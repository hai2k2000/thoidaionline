import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const requestRoute = readFileSync("src/app/api/attendance/sync/request/route.ts", "utf8");
const reconcileRoute = readFileSync("src/app/api/attendance/sync/reconcile/route.ts", "utf8");
const completeRoute = readFileSync("src/app/api/attendance/sync/complete/route.ts", "utf8");
const bridge = readFileSync("bridge/windows/attendance-bridge.ps1", "utf8");

test("scheduled sync uses a rolling three-day range", () => {
  assert.match(requestRoute, /setUTCDate\(defaultStart\.getUTCDate\(\) - 2\)/);
  assert.match(requestRoute, /period: bodyPeriod/);
  assert.match(requestRoute, /range_start: rangeStart/);
});

test("owner reconciliation is admin-only and dry-run by default", () => {
  assert.match(reconcileRoute, /role_code !== "admin"/);
  assert.match(reconcileRoute, /dry_run: dryRun/);
  assert.match(reconcileRoute, /validateAttendanceRange\("range"/);
});

test("completion audits insert, duplicate and recalculation counts", () => {
  assert.match(completeRoute, /inserted_count/);
  assert.match(completeRoute, /duplicate_skipped_count/);
  assert.match(completeRoute, /attendance_rows_recalculated/);
  assert.match(completeRoute, /if \(dryRun\)/);
});

test("bridge retries device reads with bounded backoff", () => {
  assert.match(bridge, /Invoke-WithRetry/);
  assert.match(bridge, /10, 30, 60/);
  assert.match(bridge, /source = "daily"/);
  assert.match(bridge, /period = "range"/);
});

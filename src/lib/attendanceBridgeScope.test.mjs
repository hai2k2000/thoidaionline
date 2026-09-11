import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const realtime = readFileSync("src/app/api/attendance/sync/realtime/route.ts", "utf8");
const complete = readFileSync("src/app/api/attendance/sync/complete/route.ts", "utf8");
const sync = readFileSync("src/app/api/attendance/sync/route.ts", "utf8");
const dailyRequest = readFileSync("src/app/api/attendance/sync/request/route.ts", "utf8");
const attendancePage = readFileSync("src/app/attendance/page.tsx", "utf8");
const auth = readFileSync("src/lib/attendanceBridgeAuth.ts", "utf8");
const pending = readFileSync("src/app/api/attendance/sync/pending/route.ts", "utf8");
const realtimeBridge = readFileSync("bridge/windows/attendance-realtime.ps1", "utf8");

test("realtime punches are bound to the configured device and current Vietnam date", () => {
  assert.match(realtime, /configuredAttendanceDeviceId/);
  assert.match(realtime, /deviceId !== configuredDeviceId/);
  assert.match(realtime, /localDate !== vietnamDate/);
  assert.match(realtime, /Date\.now\(\) - instant\.getTime\(\) > 10 \* 60 \* 1000/);
});

test("batch completion validates its queued device and date range", () => {
  assert.match(complete, /select\("id,status,result"\)/);
  assert.match(complete, /requestDeviceId !== configuredDeviceId/);
  assert.match(complete, /punchDate < rangeStart \|\| punchDate > rangeEnd/);
});

test("batch completion atomically claims a running request before ingesting", () => {
  assert.match(complete, /status: "completing"/);
  assert.match(complete, /eq\("status", "running"\)/);
  assert.match(complete, /claimed\.status !== "completing"/);
  assert.match(complete, /eq\("status", "completing"\)/);
});

test("admin sync requests cannot select an arbitrary attendance device", () => {
  assert.match(sync, /configuredAttendanceDeviceId/);
  assert.match(sync, /deviceId !== configuredDeviceId/);
  assert.match(sync, /validateAttendanceRange/);
});

test("attendance ranges enforce exact day, week, and calendar month boundaries", () => {
  assert.match(auth, /period === "week"\) return days === 7/);
  assert.match(auth, /start\.slice\(0, 7\) !== end\.slice\(0, 7\)/);
  assert.match(auth, /start\.endsWith\("-01"\)/);
});

test("batch logs are recomputed from canonical stored punches", () => {
  assert.match(complete, /canonicalPunches/);
  assert.match(complete, /gte\("punched_at", rangeStartInstant/);
  assert.match(complete, /lt\("punched_at", rangeEndExclusive/);
  assert.match(complete, /status: "succeeded"/);
  assert.match(complete, /maybeSingle\(\)/);
});

test("stale completing requests can be reclaimed by the bridge", () => {
  assert.match(pending, /completing/);
  assert.match(pending, /started_at/);
  assert.match(pending, /status: "running"/);
});

test("realtime bridge skips punches outside the ten-minute delivery window", () => {
  assert.match(realtimeBridge, /AddMinutes\(-10\)/);
  assert.match(realtimeBridge, /AddMinutes\(10\)/);
});

test("new sync requests recognize a request that is currently completing", () => {
  assert.match(sync, /\["pending", "running", "completing"\]/);
  assert.match(dailyRequest, /\["pending", "running", "completing"\]/);
  assert.match(attendancePage, /status: "pending" \| "running" \| "completing"/);
  assert.match(attendancePage, /status === "completing"/);
});

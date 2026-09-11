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
const recovery = readFileSync("src/lib/attendanceSyncRecovery.ts", "utf8");
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
  assert.match(pending, /buildAttendanceSyncClaimFilter/);
  assert.match(recovery, /status\.eq\.completing/);
  assert.match(recovery, /started_at\.is\.null/);
  assert.match(recovery, /requested_at\.lt/);
  assert.match(pending, /status: "running"/);
});

test("realtime bridge skips punches outside the ten-minute delivery window", () => {
  assert.match(realtimeBridge, /AddMinutes\(-10\)/);
  assert.match(realtimeBridge, /AddMinutes\(10\)/);
});

test("realtime bridge replays a deduplicated spool instead of appending the same failed punch forever", () => {
  assert.match(realtimeBridge, /function Get-SpoolRows/);
  assert.match(realtimeBridge, /function Replay-Spool/);
  assert.match(realtimeBridge, /function Add-ToSpool/);
  assert.match(realtimeBridge, /realtime-spool\.jsonl/);
  assert.match(realtimeBridge, /Replay-Spool/);
  assert.match(realtimeBridge, /enroll_number.*punched_at/);
});

test("spooled punches are replayed only inside the configured realtime window", () => {
  assert.match(realtimeBridge, /if \(-not \(Test-RealtimeWindow\)\)[\s\S]*?continue[\s\S]*?Replay-Spool/);
});

test("stale spooled punches are preserved for later reconciliation instead of being dropped", () => {
  assert.match(realtimeBridge, /deferredSpoolPath/);
  assert.match(realtimeBridge, /Add-ToDeferredSpool/);
  assert.match(realtimeBridge, /Test-RecentPunch \$row\)[\s\S]*?Add-ToDeferredSpool/);
});

test("realtime spool rewrites are single-instance and use an atomic replacement file", () => {
  assert.match(realtimeBridge, /System\.Threading\.Mutex/);
  assert.match(realtimeBridge, /WaitOne\(0\)/);
  assert.match(realtimeBridge, /function Write-SpoolRows/);
  assert.match(realtimeBridge, /\.tmp\.\$PID/);
  assert.match(realtimeBridge, /Move-Item -LiteralPath \$tempPath -Destination \$Path -Force/);
});

test("realtime delivery does not discard punches when the API explicitly skips them", () => {
  assert.match(realtimeBridge, /\$response = Invoke-RestMethod/);
  assert.match(realtimeBridge, /\$response\.skipped -eq \$true/);
  assert.match(realtimeBridge, /return \$false/);
});

test("successful spool replay marks the punch as seen before the next device scan", () => {
  assert.match(realtimeBridge, /Send-PunchCore \$row\)[\s\S]*?\$seen\[\(Punch-Key \$row\)\] = \$true/);
});

test("new sync requests recognize a request that is currently completing", () => {
  assert.match(sync, /\["pending", "running", "completing"\]/);
  assert.match(dailyRequest, /\["pending", "running", "completing"\]/);
  assert.match(attendancePage, /status: "pending" \| "running" \| "completing"/);
  assert.match(attendancePage, /status === "completing"/);
});

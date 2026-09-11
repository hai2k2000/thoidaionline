import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const realtime = readFileSync("src/app/api/attendance/sync/realtime/route.ts", "utf8");
const complete = readFileSync("src/app/api/attendance/sync/complete/route.ts", "utf8");
const sync = readFileSync("src/app/api/attendance/sync/route.ts", "utf8");

test("realtime punches are bound to the configured device and current Vietnam date", () => {
  assert.match(realtime, /configuredAttendanceDeviceId/);
  assert.match(realtime, /deviceId !== configuredDeviceId/);
  assert.match(realtime, /localDate !== vietnamDate/);
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
});

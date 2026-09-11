import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const api = readFileSync("src/app/api/attendance/sync/realtime/route.ts", "utf8");
const bridge = readFileSync("bridge/windows/attendance-realtime.ps1", "utf8");

test("realtime attendance is bounded to morning and afternoon windows", () => {
  assert.match(api, /Asia\/Ho_Chi_Minh/);
  assert.match(api, /7 \* 60 \+ 30/);
  assert.match(api, /16 \* 60 \+ 30/);
  assert.match(api, /outside_realtime_window/);
  assert.match(bridge, /Test-RealtimeWindow/);
  assert.match(bridge, /AddHours\(7\.5\)/);
  assert.match(bridge, /AddHours\(16\.5\)/);
  assert.match(bridge, /if \(-not \(Test-RealtimeWindow\)\)/);
});

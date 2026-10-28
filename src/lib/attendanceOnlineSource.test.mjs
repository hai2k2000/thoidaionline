import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("src/app/api/attendance/route.ts", "utf8");

test("attendance online entries come only from active online work schedules", () => {
  assert.match(
    route,
    /from\("online_work_schedules"\)[\s\S]*?\.eq\("status", "active"\)[\s\S]*?const online = \(onlineResult\.data \?\? \[\]\)/,
  );
  assert.doesNotMatch(route, /default-online/);
  assert.doesNotMatch(route, /isForeignReporter|FOREIGN_REPORTERS|foreignStaff|foreignById/);
  assert.doesNotMatch(route, /online\.push\(/);
});

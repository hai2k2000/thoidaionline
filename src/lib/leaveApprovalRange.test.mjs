import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("src/app/attendance/page.tsx", "utf8");

test("leave approvals use the leave month filter instead of the attendance day filter", () => {
  assert.match(page, /const approvalRange = leaveRange \?\? range/);
  assert.match(page, /from: approvalRange\.start, to: approvalRange\.end/);
  assert.doesNotMatch(page, /return leaveApprovals\.filter/);
});

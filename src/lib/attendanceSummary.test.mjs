import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("src/app/attendance/page.tsx", "utf8");
const summary = page.slice(page.indexOf("const monthlySummary"), page.indexOf("const leaveFormDays"));
const table = page.slice(page.indexOf('<h2 className="mb-2 text-lg font-semibold">Tổng công'), page.indexOf("</section>", page.indexOf('<h2 className="mb-2 text-lg font-semibold">Tổng công')));

test("attendance total summary exposes work and leave-day counts", () => {
  assert.match(summary, /daysPresent/);
  assert.match(summary, /leaveWithPermission/);
  assert.match(summary, /leaveWithoutPermission/);
  assert.match(summary, /businessDays/);
  assert.doesNotMatch(summary, /totalHours|workUnits/);
  assert.doesNotMatch(table, /Tổng giờ làm|Công quy đổi/);
});

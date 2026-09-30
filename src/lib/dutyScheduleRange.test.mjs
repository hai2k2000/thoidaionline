import assert from "node:assert/strict";
import test from "node:test";
import { scheduleCalendarDates, scheduleRange } from "./dutyScheduleRange.mjs";

test("weekly range and calendar cells run from Monday through Sunday", () => {
  const range = scheduleRange("week", "2026-10-01");
  assert.deepEqual(range, { from: "2026-09-28", to: "2026-10-04" });
  assert.deepEqual(scheduleCalendarDates("week", range.from, range.to), [
    "2026-09-28",
    "2026-09-29",
    "2026-09-30",
    "2026-10-01",
    "2026-10-02",
    "2026-10-03",
    "2026-10-04",
  ]);
});

test("monthly calendar pads Monday-first rows with Saturday and Sunday last", () => {
  const cells = scheduleCalendarDates("month", "2026-10-01", "2026-10-31");
  assert.equal(cells.length, 35);
  assert.deepEqual(cells.slice(0, 7), [
    null,
    null,
    null,
    "2026-10-01",
    "2026-10-02",
    "2026-10-03",
    "2026-10-04",
  ]);
  assert.deepEqual(cells.slice(-7), [
    "2026-10-26",
    "2026-10-27",
    "2026-10-28",
    "2026-10-29",
    "2026-10-30",
    "2026-10-31",
    null,
  ]);
});

test("day view keeps exactly one unpadded date", () => {
  assert.deepEqual(scheduleCalendarDates("day", "2026-10-01", "2026-10-01"), ["2026-10-01"]);
});

import assert from "node:assert/strict";
import test from "node:test";

import { deriveAttendanceDays, punchKey, reconcilePunches, reconciliationByDate, vietnamWorkDate } from "./attendanceReconciliation.ts";

const punch = (enroll_number, punched_at) => ({ device_id: "wise-eye-on-39-machine-1", enroll_number, punched_at });

test("one punch derives check-in and no checkout", () => {
  const result = deriveAttendanceDays([punch("4", "2026-09-24T08:00:00+07:00")]);
  assert.deepEqual(result[0], { enroll_number: "4", work_date: "2026-09-24", check_in: "08:00:00", check_out: null, punch_count: 1 });
});

test("two punches derive earliest check-in and latest checkout", () => {
  const result = deriveAttendanceDays([punch("4", "2026-09-24T08:00:00+07:00"), punch("4", "2026-09-24T17:00:00+07:00")]);
  assert.equal(result[0].check_in, "08:00:00");
  assert.equal(result[0].check_out, "17:00:00");
});

test("three or more punches still preserve first and last", () => {
  const result = deriveAttendanceDays([
    punch("4", "2026-09-24T08:00:00+07:00"),
    punch("4", "2026-09-24T12:00:00+07:00"),
    punch("4", "2026-09-24T17:00:00+07:00"),
  ]);
  assert.equal(result[0].check_in, "08:00:00");
  assert.equal(result[0].check_out, "17:00:00");
  assert.equal(result[0].punch_count, 3);
});

test("Vietnamese date is used around UTC day boundary", () => {
  assert.equal(vietnamWorkDate("2026-09-23T17:05:00Z"), "2026-09-24");
});

test("reconciling a complete device day is idempotent", () => {
  const device = [punch("4", "2026-09-24T08:00:00+07:00"), punch("4", "2026-09-24T17:00:00+07:00")];
  const first = reconcilePunches(device, []);
  const second = reconcilePunches(device, device);
  assert.equal(first.insertedCount, 2);
  assert.equal(second.insertedCount, 0);
  assert.equal(second.duplicateSkippedCount, 2);
  assert.equal(punchKey(device[0]), "wise-eye-on-39-machine-1|4|2026-09-24T01:00:00.000Z");
});

test("partial database is recognized as missing raw punches", () => {
  const device = [punch("4", "2026-09-24T08:00:00+07:00"), punch("4", "2026-09-24T17:00:00+07:00")];
  const result = reconcilePunches(device, [device[0]]);
  assert.equal(result.insertedCount, 1);
  assert.equal(result.missing[0].punched_at, device[1].punched_at);
});

test("dry-run accounting is reported per date and only mapped days affect attendance", () => {
  const device = [
    punch("4", "2026-09-21T08:00:00+07:00"),
    punch("4", "2026-09-21T17:00:00+07:00"),
    punch("999", "2026-09-21T09:00:00+07:00"),
  ];
  const result = reconciliationByDate(device, [device[0]], new Set(["4"]));
  assert.deepEqual(result, [{ work_date: "2026-09-21", device_punch_count: 3, db_before_count: 1, would_insert: 2, duplicate_skipped_count: 1, db_after_count: 3, attendance_affected: 1 }]);
});

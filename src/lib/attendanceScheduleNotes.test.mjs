import assert from "node:assert/strict";
import test from "node:test";
import { attendanceScheduleNoteEntriesFor, attendanceScheduleNotesFor } from "./attendanceScheduleNotes.mjs";

const schedule = (overrides = {}) => ({
  approval_status: "APPROVED",
  schedule_scope: "personal",
  event_status: null,
  plan_type: "business",
  work_date: "2026-10-20",
  end_date: "2026-10-21",
  title: "Làm việc tại TP.HCM",
  location: "Quận 1",
  participant_ids: ["u1"],
  ...overrides,
});

test("approved personal business and event schedules create scoped notes", () => {
  const rows = [schedule(), schedule({ plan_type: "event", title: "Họp báo ABC" })];
  assert.deepEqual(attendanceScheduleNotesFor(rows, "u1", "2026-10-20"), [
    "Đi công tác: Làm việc tại TP.HCM · Quận 1",
    "Đi sự kiện: Họp báo ABC · Quận 1",
  ]);
  assert.deepEqual(attendanceScheduleNoteEntriesFor(rows, "u2", "2026-10-20"), []);
});

test("pending, rejected, cancelled, outside-range and other plan rows are excluded", () => {
  const rows = [
    schedule({ approval_status: "PENDING_APPROVAL" }),
    schedule({ approval_status: "REJECTED" }),
    schedule({ event_status: "CANCELLED" }),
    schedule({ work_date: "2026-10-22", end_date: "2026-10-23" }),
    schedule({ plan_type: "work" }),
  ];
  assert.deepEqual(attendanceScheduleNotesFor(rows, "u1", "2026-10-20"), []);
});

test("duplicate schedules are de-duplicated and multi-day ranges remain effective", () => {
  const rows = [schedule(), schedule()];
  assert.deepEqual(attendanceScheduleNotesFor(rows, "u1", "2026-10-21"), ["Đi công tác: Làm việc tại TP.HCM · Quận 1"]);
});

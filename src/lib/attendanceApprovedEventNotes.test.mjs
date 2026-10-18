import assert from "node:assert/strict";
import test from "node:test";
import { approvedEventNotesFor, isApprovedAttendanceEvent } from "./attendanceApprovedEventNotes.mjs";

const event = (overrides = {}) => ({
  approval_status: "APPROVED",
  event_assignment_kind: "leadership",
  plan_type: "event",
  event_status: "SCHEDULED",
  work_date: "2026-10-20",
  end_date: "2026-10-21",
  title: "Họp báo phía Nam",
  location: "TP.HCM",
  participant_ids: ["u1"],
  ...overrides,
});

test("approved event note is visible only to assigned staff in its date range", () => {
  assert.deepEqual(approvedEventNotesFor([event()], "u1", "2026-10-20"), ["Lịch công tác: Họp báo phía Nam · TP.HCM"]);
  assert.deepEqual(approvedEventNotesFor([event()], "u1", "2026-10-21"), ["Lịch công tác: Họp báo phía Nam · TP.HCM"]);
  assert.deepEqual(approvedEventNotesFor([event()], "u2", "2026-10-20"), []);
  assert.deepEqual(approvedEventNotesFor([event()], "u1", "2026-10-22"), []);
});

test("pending, rejected, cancelled, and non-event schedules never create attendance notes", () => {
  for (const overrides of [
    { approval_status: "PENDING_APPROVAL" },
    { approval_status: "REJECTED" },
    { event_status: "CANCELLED" },
    { plan_type: "work" },
    { event_assignment_kind: null },
  ]) {
    assert.equal(isApprovedAttendanceEvent(event(overrides)), false);
    assert.deepEqual(approvedEventNotesFor([event(overrides)], "u1", "2026-10-20"), []);
  }
});

test("assignment relation is accepted when participant_ids is stale", () => {
  assert.deepEqual(approvedEventNotesFor([event({ participant_ids: [], event_assignments: [{ staff_id: "u1" }] })], "u1", "2026-10-20"), ["Lịch công tác: Họp báo phía Nam · TP.HCM"]);
});

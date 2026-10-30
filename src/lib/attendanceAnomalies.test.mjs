import test from "node:test";
import assert from "node:assert/strict";
import { detectAttendanceAnomalies } from "./attendanceAnomalies.mjs";

const staff = [{ id: "a", full_name: "An", department_name: "A" }, { id: "b", full_name: "Bình", department_name: "A" }];
const log = (user_id, work_date, check_in, check_out) => ({ user_id, work_date, check_in, check_out });

test("detects same-time pairs only when both punches are close", () => {
  const close = detectAttendanceAnomalies({ logs: [log("a", "2026-01-02", "08:00:00", "17:00:00"), log("b", "2026-01-02", "08:00:05", "17:00:08")], leaves: [], schedules: [], eventAssignments: [], staff });
  assert.equal(close.findings[0].type, "same_time_pair");
  const far = detectAttendanceAnomalies({ logs: [log("a", "2026-01-02", "08:00:00", "17:00:00"), log("b", "2026-01-02", "08:00:05", "17:30:00")], leaves: [], schedules: [], eventAssignments: [], staff });
  assert.equal(far.findings.length, 0);
});

test("escalates pairs repeated on three days", () => {
  const logs = [1, 2, 3].flatMap((day) => [log("a", `2026-01-0${day}`, "08:00:00", "17:00:00"), log("b", `2026-01-0${day}`, "08:00:05", "17:00:05")]);
  const result = detectAttendanceAnomalies({ logs, leaves: [], schedules: [], eventAssignments: [], staff });
  assert.equal(result.findings.every((item) => item.severity === "high"), true);
  assert.equal(result.pairSummary[0].days, 3);
});

test("applies leave periods and schedule de-duplication", () => {
  const logs = [log("a", "2026-01-05", "08:00:00", "18:22:00")];
  const leaves = [{ id: "l1", requester_id: "a", start_date: "2026-01-05", end_date: "2026-01-05", start_period: "afternoon", end_period: "afternoon" }];
  const schedules = [{ id: "s1", plan_type: "business", title: "Trip", work_date: "2026-01-01", end_date: "2026-01-05", participant_ids: ["a"] }, { id: "s2", plan_type: "business", title: "Trip 2", work_date: "2026-01-05", end_date: "2026-01-06", participant_ids: ["a"] }];
  const result = detectAttendanceAnomalies({ logs, leaves, schedules, eventAssignments: [], staff });
  assert.equal(result.findings.filter((item) => item.type === "leave_with_punch").length, 1);
  assert.equal(result.findings.filter((item) => item.type === "business_with_punch").length, 1);
  assert.deepEqual(result.findings.find((item) => item.type === "business_with_punch").detail.scheduleTitles, ["Trip", "Trip 2"]);
});

test("handles morning, afternoon, event assignments and sorting", () => {
  const logs = [log("a", "2026-01-03", "13:00:00", "18:00:00"), log("b", "2026-01-04", "08:00:00", "18:00:00")];
  const leaves = [{ id: "m", requester_id: "a", start_date: "2026-01-03", end_date: "2026-01-03", start_period: "morning", end_period: "morning" }];
  const schedules = [{ id: "e", plan_type: "event", title: "Event", work_date: "2026-01-04", end_date: "2026-01-04", start_time: "09:00:00", end_time: "17:00:00", participant_ids: [] }];
  const result = detectAttendanceAnomalies({ logs, leaves, schedules, eventAssignments: [{ event_id: "e", staff_id: "b" }], staff });
  assert.equal(result.findings.some((item) => item.type === "leave_with_punch"), false);
  assert.equal(result.findings.find((item) => item.type === "event_with_punch").severity, "medium");
  assert.equal(result.findings[0].severity, "medium");
});

test("detector tolerates null inputs and formats dates in Vietnamese", async () => {
  const { detectAttendanceAnomalies } = await import("./attendanceAnomalies.mjs");
  const result = detectAttendanceAnomalies({
    logs: [{ user_id: "a", work_date: "2026-09-15", check_in: "07:53:00", check_out: "18:22:43" }],
    leaves: [{ id: "l1", requester_id: "a", start_date: "2026-09-15", end_date: "2026-09-15", start_period: "afternoon", end_period: "afternoon" }],
    schedules: null,
    eventAssignments: null,
    staff: [{ id: "a", full_name: "A", department_name: "P" }],
  });
  assert.equal(result.findings.length, 1);
  assert.match(result.findings[0].message, /15\/09\/2026/);
});

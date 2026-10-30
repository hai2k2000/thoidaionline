import test from "node:test";
import assert from "node:assert/strict";
import { classifyAttendanceDay } from "./attendanceDayStatus.mjs";

const base = { workDate: "2026-10-05", today: "2026-10-28", isBusinessDate: true };

test("classifies every attendance day status with precedence", () => {
  assert.equal(classifyAttendanceDay({ ...base, workDate: "2026-10-29" }).code, "future");
  assert.equal(classifyAttendanceDay({ ...base, isBusinessDate: false }).code, "weekend");
  assert.equal(classifyAttendanceDay({ ...base, leave: { full: true }, log: { check_in: "08:00", check_out: "17:00" } }).code, "leave_full");
  assert.equal(classifyAttendanceDay({ ...base, leave: { full: false } }).code, "leave_half");
  assert.equal(classifyAttendanceDay({ ...base, business: true }).code, "business");
  assert.equal(classifyAttendanceDay({ ...base, online: true }).code, "online");
  assert.equal(classifyAttendanceDay({ ...base, log: { check_in: "08:00", check_out: "17:00" } }).code, "present");
  assert.equal(classifyAttendanceDay({ ...base, log: { check_in: "08:20", check_out: null }, calculation: { workday: 0 } }).code, "incomplete");
  assert.equal(classifyAttendanceDay(base).code, "absent");
});

test("uses Vietnam today boundary and adjustment workday", () => {
  const result = classifyAttendanceDay({ ...base, adjustment: { workday: 0.5 }, log: { check_in: "08:00", check_out: "17:00" } });
  assert.equal(result.code, "present");
  assert.equal(result.workday, 0.5);
  assert.match(result.label, /điều chỉnh/);
  assert.equal(classifyAttendanceDay({ ...base, workDate: "2026-10-28", today: "2026-10-28" }).code, "absent");
});

test("detects forgot-card notes with QQ taking precedence over QT", () => {
  const forgotSwipe = classifyAttendanceDay({ ...base, adminNote: "Đã xác nhận: QUÊN QUẸT THẺ" });
  assert.deepEqual({ code: forgotSwipe.code, symbol: forgotSwipe.symbol, label: forgotSwipe.label, workday: forgotSwipe.workday }, {
    code: "forgot_swipe", symbol: "QQ", label: "Quên quẹt thẻ", workday: 1,
  });
  assert.equal(classifyAttendanceDay({ ...base, note: "Nhân sự quên thẻ" }).code, "forgot_card");
});

test("leave beats forgot marks while forgot marks beat presence and absence", () => {
  assert.equal(classifyAttendanceDay({ ...base, leave: { full: true }, adminNote: "Quên thẻ" }).code, "leave_full");
  assert.equal(classifyAttendanceDay({ ...base, adminNote: "Quên thẻ", log: { check_in: "08:00", check_out: "17:00" } }).code, "forgot_card");
  assert.equal(classifyAttendanceDay({ ...base, adminNote: "Quên quẹt thẻ" }).code, "forgot_swipe");
});

test("forgot marks count one workday unless an adjustment overrides them", () => {
  assert.equal(classifyAttendanceDay({ ...base, note: "Quên thẻ" }).workday, 1);
  assert.equal(classifyAttendanceDay({ ...base, note: "Quên thẻ", calculation: { workday: 0 } }).workday, 1);
  assert.equal(classifyAttendanceDay({ ...base, note: "Quên thẻ", adjustment: { workday: 0.5 } }).workday, 0.5);
});

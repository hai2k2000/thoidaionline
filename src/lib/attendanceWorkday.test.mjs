import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { calculateAttendance } from "./attendanceWorkday.ts";
import { vietnamTime, vietnamWorkDate } from "./attendanceReconciliation.ts";

const calculate = (checkIn, checkOut, options = {}) => calculateAttendance({ checkIn, checkOut, ...options });

test("complete normal attendance counts one workday", () => {
  assert.equal(calculate("08:00", "17:00").workday, 1);
  assert.equal(calculate("08:00", "17:00").note, "");
  assert.equal(calculate("08:10", "16:45").workday, 1);
});

test("08:15 and 16:30 boundaries are on time", () => {
  const result = calculate("08:15:00", "16:30:00");
  assert.equal(result.workday, 1);
  assert.equal(result.late, false);
  assert.equal(result.early, false);
  assert.equal(result.note, "");
});

test("strictly late check-in keeps one workday and adds the late note", () => {
  assert.deepEqual(calculate("08:16", "17:00"), { workday: 1, late: true, early: false, note: "Đi muộn" });
  assert.equal(calculate("08:15:01", "17:00").late, true);
});

test("strictly early check-out keeps one workday and adds the early note", () => {
  assert.deepEqual(calculate("08:00", "16:29"), { workday: 1, late: false, early: true, note: "Về sớm" });
  assert.equal(calculate("08:00", "16:29:59").early, true);
});

test("late and early compose in deterministic order without duplicates", () => {
  const result = calculate("08:16", "16:29", { existingNote: "Đi muộn" });
  assert.deepEqual(result, { workday: 1, late: true, early: true, note: "Đi muộn; Về sớm" });
});

test("missing times do not count a normal workday", () => {
  assert.equal(calculate(null, "17:00").workday, 0);
  assert.equal(calculate(null, "17:00").note, "Thiếu giờ vào");
  assert.equal(calculate("08:00", null).workday, 0);
  assert.equal(calculate("08:00", null).note, "Thiếu giờ ra");
});

test("both missing times expose both missing-time notes", () => {
  assert.equal(calculate(null, null).workday, 0);
  assert.equal(calculate(null, null).note, "Thiếu giờ vào; Thiếu giờ ra");
});

test("approved absence exceptions preserve zero workday and existing notes", () => {
  const result = calculate(null, null, { exceptional: true, existingNote: "Nghỉ phép" });
  assert.deepEqual(result, { workday: 0, late: false, early: false, note: "Nghỉ phép" });
});

test("manual/context notes are preserved after generated flags", () => {
  assert.equal(calculate("08:16", "17:00", { existingNote: "Đi họp" }).note, "Đi muộn; Đi họp");
});

test("online exception can preserve one workday without inventing late or early", () => {
  assert.deepEqual(calculate(null, null, { exceptional: true, exceptionalWorkday: 1, extraNotes: ["Làm việc online"] }), { workday: 1, late: false, early: false, note: "Làm việc online" });
});

test("UTC timestamps normalize to Vietnam local date and time before calculation", () => {
  assert.equal(vietnamWorkDate("2026-09-23T23:16:00Z"), "2026-09-24");
  assert.equal(vietnamTime("2026-09-23T23:16:00Z"), "06:16:00");
  assert.equal(calculate("06:16:00", "16:30:00").workday, 1);
  assert.equal(calculate("06:16:00", "16:30:00").late, false);
});

test("server and UI consume the canonical workday calculation", () => {
  const route = readFileSync(new URL("../app/api/attendance/route.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/attendance/page.tsx", import.meta.url), "utf8");
  assert.match(route, /calculateAttendance/);
  assert.match(route, /workday: calculation\.workday/);
  assert.match(page, /r\.workday === 1/);
  assert.match(page, /Ngày công/);
});

test("Wise On 39 sync note alone is removed", () => {
  assert.equal(calculate("08:00", "17:00", { existingNote: "Đồng bộ từ Wise On 39" }).note, "");
});

test("realtime Wise Eye On 39 sync note is removed", () => {
  assert.equal(calculate("08:00", "17:00", { existingNote: "Đồng bộ realtime từ Wise Eye On 39" }).note, "");
});

test("Wise On 39 sync note matching is case and whitespace tolerant", () => {
  assert.equal(calculate("08:00", "17:00", { existingNote: "  đồng   bộ từ WiseOn39  " }).note, "");
});

test("all Wise Eye On 39 sync note variants are removed", () => {
  for (const note of [
    "Đồng bộ từ Wise Eye On 39",
    "Đồng bộ realtime từ Wise Eye On 39",
    "đồng   bộ realtime từ WiseOn39",
  ]) {
    assert.equal(calculate("08:00", "17:00", { existingNote: note }).note, "");
  }
});

test("approved business trip counts a full day and a half day", () => {
  assert.equal(calculate(null, null, { exceptional: true, exceptionalWorkday: 1, extraNotes: ["Công tác"] }).workday, 1);
  assert.equal(calculate(null, null, { exceptional: true, exceptionalWorkday: 0.5, extraNotes: ["Công tác theo buổi"] }).workday, 0.5);
});

test("Wise On 39 sync note is removed while late note remains", () => {
  assert.equal(calculate("08:20", "17:00", { existingNote: "Đồng bộ từ Wise On 39" }).note, "Đi muộn");
});

test("Wise On 39 sync note is removed while early note remains", () => {
  assert.equal(calculate("08:00", "16:15", { existingNote: "Đồng bộ từ Wise On 39" }).note, "Về sớm");
});

test("Wise On 39 sync note is removed while genuine manual note remains", () => {
  assert.equal(calculate("08:00", "16:15", { existingNote: "Đồng bộ từ Wise On 39; Ghi chú quản trị" }).note, "Về sớm; Ghi chú quản trị");
});

test("Wise On 39 sync note does not affect late and early ordering", () => {
  assert.equal(calculate("08:30", "16:00", { existingNote: "Đồng bộ từ Wise On 39" }).note, "Đi muộn; Về sớm");
});

test("Wise On 39 sync note does not replace missing-time notes", () => {
  assert.equal(calculate(null, "17:00", { existingNote: "Đồng bộ từ Wise On 39" }).note, "Thiếu giờ vào");
  assert.equal(calculate("08:00", null, { existingNote: "Đồng bộ từ Wise On 39" }).note, "Thiếu giờ ra");
});

test("Wise On 39 sync note is removed without changing leave note", () => {
  assert.equal(calculate(null, null, { exceptional: true, existingNote: "Đồng bộ từ Wise On 39; Nghỉ phép" }).note, "Nghỉ phép");
});

test("unrelated manual notes remain unchanged", () => {
  assert.equal(calculate("08:00", "17:00", { existingNote: "Ghi chú bình thường" }).note, "Ghi chú bình thường");
});

test("Wise On 39 cleanup does not change workday calculation", () => {
  const result = calculate("08:20", "16:15", { existingNote: "Đồng bộ từ Wise On 39" });
  assert.equal(result.workday, 1);
  assert.equal(result.late, true);
  assert.equal(result.early, true);
});

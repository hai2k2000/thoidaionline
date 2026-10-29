import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { calculateAttendance } from "./attendanceWorkday.ts";
import { vietnamTime, vietnamWorkDate } from "./attendanceReconciliation.ts";

const calculate = (checkIn, checkOut, options = {}) => calculateAttendance({ checkIn, checkOut, ...options });
const attendanceRoute = readFileSync(new URL("../app/api/attendance/route.ts", import.meta.url), "utf8");
const exportRoute = readFileSync(new URL("../app/api/attendance/export/route.ts", import.meta.url), "utf8");
const exportLib = readFileSync(new URL("./attendanceExport.mjs", import.meta.url), "utf8");
const adjustmentRoute = readFileSync(new URL("../app/api/attendance/workday-adjustment/route.ts", import.meta.url), "utf8");
const adjustmentMigration = readFileSync(new URL("../../supabase/migrations/20261028170000_attendance_workday_adjustments.sql", import.meta.url), "utf8");

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

test("late exception status controls the generated note", () => {
  assert.equal(calculate("08:16", "17:00", { lateExceptionStatus: "pending" }).note, "Đi muộn (chờ duyệt lý do phát sinh)");
  assert.equal(calculate("08:16", "17:00", { lateExceptionStatus: "approved" }).note, "Đi muộn do việc phát sinh");
  assert.equal(calculate("08:16", "17:00", { lateExceptionStatus: "rejected" }).note, "Đi muộn");
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

test("workday adjustments override the calculated workday and add the adjustment note", () => {
  assert.match(attendanceRoute, /row\.workday\s*=\s*row\.workday_adjustment\?\.workday\s*\?\?\s*calculation\.workday/);
  assert.match(attendanceRoute, /row\.note\s*=\s*row\.workday_adjustment\s*\?\s*`Điều chỉnh công: \$\{row\.workday_adjustment\.workday\} \(\$\{row\.workday_adjustment\.reason\}\)`/);
  assert.match(attendanceRoute, /existingRow\.workday\s*=\s*Number\(adjustment\.workday\)/);
});

test("monthly summary consumes the adjusted workday value", () => {
  assert.match(attendanceRoute, /monthlyRows:\s*contextRows\(/);
  assert.match(attendanceRoute, /const withNotes = \(items: AttendanceRow\[\],[\s\S]*adjustments: typeof dayAdjustments\)/);
  assert.match(attendanceRoute, /withNotes[\s\S]*return \{ \.\.\.row, workday: adjustment \? adjustment\.workday : calculation\.workday/);
});

test("October 2026 export has one column per weekday", () => {
  const weekdays = [];
  for (let day = 1; day <= 31; day += 1) {
    const weekday = new Date(Date.UTC(2026, 9, day)).getUTCDay();
    if (weekday !== 0 && weekday !== 6) weekdays.push(day);
  }
  assert.equal(weekdays.length, 22);
  assert.match(exportLib, /!\[0, 6\]\.includes\(new Date\(`\$\{day\}T12:00:00Z`\)\.getUTCDay\(\)\)/);
});

test("CSV export emits UTF-8 BOM, escapes values, and protects formulas", () => {
  assert.match(exportLib, /return `.\$\{lines\.join\("\\n"\)\}\\n`;/);
  assert.ok(exportRoute.includes("buildAttendanceExportCsv("));
  assert.ok(exportLib.includes('text.replace(/"/g, \'\"\"\')'));
  assert.ok(exportLib.includes('/[",\\n]/.test(text)'));
  assert.ok(exportLib.includes('/^[=+\\-@]/.test(text)'));
  assert.ok(exportLib.includes("text = `'${text}`"));
});

test("attendance routes use resolved access and actor-scoped adjustment RPCs", () => {
  assert.match(exportRoute, /resolveAttendanceAccess\(guard\.actor\)/);
  assert.doesNotMatch(exportRoute, /role_code/);
  assert.match(attendanceRoute, /p_actor:\s*guard\.actor\.id/);
  assert.match(adjustmentRoute, /export \{ PUT, DELETE \} from "\.\.\/route"/);
  assert.match(attendanceRoute, /42501[\s\S]*403/);
  assert.match(attendanceRoute, /22023[\s\S]*400/);
});

test("workday adjustment migration locks down RLS, RPC execution, and validation", () => {
  assert.match(adjustmentMigration, /alter table public\.attendance_workday_adjustments enable row level security/i);
  assert.match(adjustmentMigration, /revoke all privileges on table public\.attendance_workday_adjustments from public, anon, authenticated/i);
  for (const fn of ["api_upsert_attendance_workday_adjustment", "api_delete_attendance_workday_adjustment"]) {
    assert.match(adjustmentMigration, new RegExp(`create or replace function public\\.${fn}[\\s\\S]*security definer`, "i"));
    assert.match(adjustmentMigration, new RegExp(`revoke all on function public\\.${fn}[\\s\\S]*grant execute on function public\\.${fn}[\\s\\S]*service_role`, "i"));
  }
  assert.match(adjustmentMigration, /if p_actor = p_user_id then raise exception 'Self adjustment forbidden\.'/i);
  assert.match(adjustmentMigration, /extract\(isodow from p_work_date\) > 5/);
  assert.match(adjustmentMigration, /check \(workday in \(0, 0\.5, 1\)\)/i);
});

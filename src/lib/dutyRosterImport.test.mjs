import assert from "node:assert/strict";
import test from "node:test";
import { groupDutyImportRows, resolveDutyImportRows, summarizeDutyImport, validateDutyImportRows } from "./dutyRosterImport.mjs";

const rows = [
  { date: "2026-10-01", position: "Xuất bản", name: "A" },
  { date: "2026-10-01", position: "Biên tập", name: "B" },
  { date: "2026-10-01", position: "Phóng viên", name: "C" },
];

test("resolves names only when they map to one active person", () => {
  const result = resolveDutyImportRows(rows, [
    { id: "1", full_name: "A", username: "a" },
    { id: "2", full_name: "B", username: "b" },
    { id: "3", full_name: "C", username: "c" },
  ]);
  assert.equal(result.errors.length, 0);
  assert.deepEqual(result.resolved.map((row) => row.assigneeId), ["1", "2", "3"]);
});

test("rejects unmatched and ambiguous employee names", () => {
  const result = resolveDutyImportRows(rows, [
    { id: "1", full_name: "A", username: "a" },
    { id: "2", full_name: "B", username: "b" },
    { id: "3", full_name: "C", username: "c" },
    { id: "4", full_name: "C", username: "c2" },
  ]);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].reason, /trùng/);
});

test("resolves approved roster shorthand names to their canonical usernames", () => {
  const result = resolveDutyImportRows([
    { date: "2026-10-01", position: "Biên tập", name: "Hồng Ninh" },
    { date: "2026-10-01", position: "Phóng viên", name: "Hải Doan" },
    { date: "2026-10-02", position: "Phóng viên", name: "Phạm Lý" },
    { date: "2026-10-03", position: "Phóng viên", name: "Mai Anh" },
  ], [
    { id: "1", full_name: "Tưởng Thị Hồng Ninh", username: "hongninh" },
    { id: "2", full_name: "Phan Thị Doan", username: "thidoan" },
    { id: "3", full_name: "Phạm Thị Lý", username: "thily" },
    { id: "4", full_name: "Vũ Mai Anh", username: "maianh" },
  ]);
  assert.equal(result.errors.length, 0);
  assert.deepEqual(result.resolved.map((row) => row.assigneeId), ["1", "2", "3", "4"]);
});

test("groups resolved rows into the existing monthly roster RPC shape", () => {
  const grouped = groupDutyImportRows(rows.map((row, index) => ({ ...row, assigneeId: String(index + 1) })));
  assert.deepEqual(grouped, [{ date: "2026-10-01", assignments: [{ position: "Xuất bản", assigneeId: "1" }, { position: "Biên tập", assigneeId: "2" }, { position: "Phóng viên", assigneeId: "3" }] }]);
});

test("validates a complete month without allowing duplicate date-position keys", () => {
  const complete = [];
  for (let day = 1; day <= 31; day += 1) for (const position of ["Xuất bản", "Biên tập", "Phóng viên"]) complete.push({ date: `2026-10-${String(day).padStart(2, "0")}`, position, name: "A" });
  assert.equal(validateDutyImportRows("2026-10", complete), true);
  assert.equal(validateDutyImportRows("2026-10", [...complete.slice(0, -1), complete[0]]), false);
});

test("summarizes create update unchanged and locked rows before confirmation", () => {
  const preview = summarizeDutyImport([
    { date: "2026-10-01", position: "Xuất bản", assigneeId: "1" },
    { date: "2026-10-01", position: "Biên tập", assigneeId: "2" },
    { date: "2026-10-01", position: "Phóng viên", assigneeId: "3" },
  ], [
    { due_date: "2026-10-01", duty_position: "Xuất bản", assignee_id: "1", status: "new" },
    { due_date: "2026-10-01", duty_position: "Biên tập", assignee_id: "9", status: "new" },
    { due_date: "2026-10-01", duty_position: "Phóng viên", assignee_id: "8", status: "in_progress" },
  ]);
  assert.deepEqual(preview, { create: 0, update: 2, unchanged: 1, cancel: 0, locked: 1 });
});

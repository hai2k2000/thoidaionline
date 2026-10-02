import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./DepartmentPlanGrid.tsx", import.meta.url), "utf8");

test("add-row action is below the grid, not in the header", () => {
  const header = source.slice(source.indexOf("<div className=\"flex flex-wrap items-center"), source.indexOf("{message ?"));
  assert.doesNotMatch(header, /Thêm dòng/);
  assert.match(source, /border-t border-slate-100 pt-3/);
  assert.match(source, /\+ Thêm dòng/);
});

test("persisted rows keep non-wrapping text primary actions", () => {
  assert.match(source, /Giao việc/);
  assert.match(source, /Xem công việc/);
  assert.match(source, /min-w-\[92px\] whitespace-nowrap/);
  assert.match(source, /min-w-\[100px\].*whitespace-nowrap/);
  assert.doesNotMatch(source, /details className=\"relative\"/);
});

test("secondary row actions are compact accessible icon buttons", () => {
  assert.equal((source.match(/<IconActionButton label=\"Chi tiết\"/g) ?? []).length, 2);
  assert.equal((source.match(/<IconActionButton label=\"Chỉnh sửa\"/g) ?? []).length, 2);
  assert.equal((source.match(/<IconActionButton label=\"Xóa\"/g) ?? []).length, 2);
  assert.match(source, /title=\{label\}/);
  assert.match(source, /aria-label=\{label\}/);
  assert.match(source, /focus:ring-2/);
});

test("draft rows keep save and cancel controls", () => {
  assert.match(source, /row\.saving \? "Đang lưu…" : "Lưu"/);
  assert.match(source, /onClick=\{\(\) => cancelEdits\(row\)\}/);
});

test("generic Plan rows do not expose an assignment claim control", () => {
  assert.doesNotMatch(source, /assignmentValue|assignmentPatch/);
  assert.doesNotMatch(source, /employees\.map\(\(employee\) => <option/);
  assert.match(source, /Chưa tạo công việc/);
  assert.match(source, /Giao việc/);
});

test("date-only input preserves Vietnam calendar date for persistence", () => {
  assert.doesNotMatch(source, /datetime-local/);
  assert.equal((source.match(/type=\"date\"/g) ?? []).length, 2);
  assert.match(source, /timeZone: "Asia\/Ho_Chi_Minh"/);
  assert.match(source, /T00:00:00\+07:00/);
  assert.match(source, /outsidePeriod/);
});

test("assignment popup and responsive cards remain unchanged", () => {
  assert.match(source, /setAssignmentId\(row\.key\)/);
  assert.match(source, /DepartmentPlanQuickAssignDialog/);
  assert.match(source, /linkedTaskId/);
  assert.match(source, /md:hidden/);
  assert.match(source, /<article key=\{row\.key\}/);
});

test("persisted unlinked rows open the same validated assignment flow", () => {
  const actionStart = source.indexOf("row.linkedTaskId ? <a");
  const actionEnd = source.indexOf("</div></td>", actionStart);
  const actions = source.slice(actionStart, actionEnd);
  assert.match(actions, /onClick=\{\(\) => void openAssignment\(row\)\}/);
  assert.doesNotMatch(actions, /onClick=\{\(\) => setAssignmentId\(row\.id!\)\}/);
});

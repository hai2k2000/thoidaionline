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

test("persisted rows keep text primary actions", () => {
  assert.match(source, /Giao việc/);
  assert.match(source, /Mở công việc/);
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

test("assignment semantics and responsive cards remain unchanged", () => {
  for (const value of ["unassigned", "department_wide", "assigned"]) assert.match(source, new RegExp(`value=\"${value}\"`));
  assert.match(source, /setAssignmentId\(row\.id!\)/);
  assert.match(source, /DepartmentPlanAssignmentDialog/);
  assert.match(source, /linkedTaskId/);
  assert.match(source, /md:hidden/);
  assert.match(source, /<article key=\{row\.key\}/);
});

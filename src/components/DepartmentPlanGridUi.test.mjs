import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./DepartmentPlanGrid.tsx", import.meta.url), "utf8");

test("persisted rows use one primary action and a compact overflow menu", () => {
  assert.match(source, /Giao việc/);
  assert.match(source, /Mở công việc/);
  assert.match(source, /<details className=\"relative\">/);
  assert.match(source, /Chi tiết/);
  assert.match(source, /Chỉnh sửa/);
  assert.match(source, /Xóa/);
  assert.doesNotMatch(source, /space-y-2 p-2/);
});

test("draft rows keep explicit save and cancel controls", () => {
  assert.match(source, /draft \?/);
  assert.match(source, /row\.saving \? "Đang lưu…" : "Lưu"/);
  assert.match(source, /onClick=\{\(\) => cancelEdits\(row\)\}/);
});

test("assignment states and canonical actions remain unchanged", () => {
  for (const value of ["unassigned", "department_wide", "assigned"]) assert.match(source, new RegExp(`value=\"${value}\"`));
  assert.match(source, /setAssignmentId\(row\.id!\)/);
  assert.match(source, /DepartmentPlanAssignmentDialog/);
  assert.match(source, /linkedTaskId/);
});

test("mobile uses stacked cards without a forced table width", () => {
  assert.match(source, /md:hidden/);
  assert.match(source, /<article key=\{row\.key\}/);
  assert.match(source, /hidden overflow-x-auto md:block/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (name) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

test("detail dialog loads without mutation and exposes approved fields", () => {
  const source = read("DepartmentPlanItemDialog.tsx");
  assert.match(source, /fetch\(`\/api\/planning\/department\/items\/\$\{itemId\}`\)/);
  assert.doesNotMatch(source.slice(0, source.indexOf("const save")), /method:\s*["'](POST|PATCH|DELETE)/);
  for (const field of ["title", "description", "requirements", "dueAt", "assigneeId", "assignmentState", "workStatus", "created_by", "created_at", "updated_at"]) assert.match(source, new RegExp(field));
});

test("dialog saves only the Department Plan item and has no Task mutation", () => {
  const source = read("DepartmentPlanItemDialog.tsx");
  assert.match(source, /method: "PATCH"/);
  assert.doesNotMatch(source, /\/api\/tasks|createTask|linked_task_id/);
  assert.match(source, /onSaved\(savedItem\)/);
});

test("dialog implements cancel, close confirmation, and Escape handling", () => {
  const source = read("DepartmentPlanItemDialog.tsx");
  assert.match(source, /JSON\.stringify\(original\).*JSON\.stringify\(draft\)/);
  assert.match(source, /Hủy thay đổi/);
  assert.match(source, /Đóng và bỏ thay đổi/);
  assert.match(source, /event\.key !== "Escape"/);
});

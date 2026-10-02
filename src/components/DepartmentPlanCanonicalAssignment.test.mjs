import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (name) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

test("Department Plan uses the canonical form and one-task dialog contract", () => {
  const dialog = read("DepartmentPlanAssignmentDialog.tsx");
  const grid = read("DepartmentPlanGrid.tsx");
  const detail = read("DepartmentPlanItemDialog.tsx");
  assert.match(dialog, /CanonicalAssignmentForm/);
  assert.match(dialog, /initialValues/);
  assert.match(dialog, /singleTaskOnly/);
  assert.match(dialog, /disableAttachments/);
  assert.match(dialog, /items\/\$\{item\.id\}\/assign/);
  assert.doesNotMatch(dialog, /api\/tasks\/assign/);
  for (const field of ["title", "description", "requirements", "dueDate", "assigneeId", "departmentId"]) assert.match(dialog, new RegExp(field));
  assert.match(grid, /Giao việc/);
  assert.match(detail, /Giao việc/);
  assert.doesNotMatch(grid + detail, /Tạo công việc/);
});

test("linked items expose only the existing Task", () => {
  const source = read("DepartmentPlanGrid.tsx") + read("DepartmentPlanItemDialog.tsx");
  assert.match(source, /Xem công việc/);
  assert.match(source, /linkedTaskId|linked_task_id/);
});

test("dirty Plan Items cannot enter assignment flow", () => {
  const source = read("DepartmentPlanItemDialog.tsx");
  assert.match(source, /Hãy lưu hoặc hủy thay đổi mục kế hoạch trước khi giao việc/);
  assert.match(source, /disabled=\{saving \|\| dirty\}/);
});

test("V2 server contract is additive and atomic", () => {
  const migration = readFileSync(new URL("../../supabase/migrations/20260926160000_department_plan_assignment_v2.sql", import.meta.url), "utf8");
  const repository = readFileSync(new URL("../lib/departmentPlanRepository.ts", import.meta.url), "utf8");
  assert.match(migration, /api_assign_department_plan_task_v2/);
  assert.match(migration, /for update/);
  assert.match(migration, /linked_task_id is null/);
  assert.match(migration, /api_assign_task_v2/);
  assert.match(migration, /return v_task/);
  assert.match(repository, /assignTaskFromItem/);
  assert.match(repository, /api_assign_department_plan_task_v2/);
});

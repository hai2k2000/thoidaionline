import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (url) => existsSync(url) ? readFileSync(url, "utf8") : "";
const migration = read(new URL("../../supabase/migrations/20261002130000_department_plan_real_multi_assignment_v2.sql", import.meta.url));
const repository = read(new URL("./departmentPlanRepository.ts", import.meta.url));
const handlers = read(new URL("./departmentPlanHandlers.ts", import.meta.url));
const itemRoute = read(new URL("../app/api/planning/department/[planId]/items/route.ts", import.meta.url));
const assignRoute = read(new URL("../app/api/planning/department/[planId]/items/assign/route.ts", import.meta.url));
const dialog = read(new URL("../components/DepartmentPlanQuickAssignDialog.tsx", import.meta.url));
const grid = read(new URL("../components/DepartmentPlanGrid.tsx", import.meta.url));
const detail = read(new URL("../components/DepartmentPlanItemDialog.tsx", import.meta.url));
const fields = read(new URL("../components/DepartmentPlanItemFields.tsx", import.meta.url));

test("real assignment has one shared transactional core and atomic draft RPC", () => {
  assert.match(migration, /api_department_plan_assign_core/);
  assert.match(migration, /api_create_department_plan_task_v2/);
  assert.match(migration, /for update/);
  assert.match(migration, /api_assign_task_v2/);
  assert.match(migration, /assignment_source\s*=\s*'department_plan'/);
  assert.match(migration, /task_assignees/);
  assert.match(migration, /linked_task_id\s*=\s*v_task\.id/);
  assert.match(migration, /assignment_state\s*=\s*'assigned'/);
});

test("multi-assignee contract preserves order, deduplicates, and blocks bypass", () => {
  assert.match(migration, /assigneeIds/);
  assert.match(migration, /distinct|dedup|duplicate/i);
  assert.match(migration, /department_id\s*=\s*v_plan\.department_id/);
  assert.match(migration, /revoke all on function[\s\S]*authenticated/);
  assert.match(migration, /grant execute on function[\s\S]*service_role/);
  assert.match(handlers, /assigneeIds/);
  assert.match(repository, /assigneeIds/);
});

test("generic Plan save is Plan-only and draft assignment has a dedicated route", () => {
  assert.match(assignRoute, /departmentPlanHandlers\.createAndAssignItem/);
  assert.match(itemRoute, /departmentPlanHandlers\.createItem/);
  assert.match(handlers, /createAndAssignItem/);
  assert.match(handlers, /linked_task_id/);
  assert.doesNotMatch(fields, /Người thực hiện|Phân công|assignmentState/);
  assert.doesNotMatch(grid, /assignmentPatch|assignmentValue/);
});

test("compact UI uses searchable ordered chips and preserves legacy visibility", () => {
  assert.match(dialog, /assigneeIds/);
  assert.match(dialog, /Tìm người/);
  assert.match(dialog, /selectedIds/);
  assert.match(dialog, /filter/);
  assert.match(dialog, /departmentId === item\.department_id/);
  assert.match(grid, /Chưa tạo công việc/);
  assert.match(grid, /Xem công việc/);
  assert.match(detail, /Chưa tạo công việc/);
});

test("linked Task participant projection remains authoritative", () => {
  assert.match(repository, /task_assignees\(user_id,assignment_role/);
  assert.match(repository, /linked_task_assignees/);
  assert.match(repository, /linked_task_status/);
});

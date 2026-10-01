import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (url) => existsSync(url) ? readFileSync(url, "utf8") : "";
const migration = read(new URL("../../supabase/migrations/20261001120000_department_plan_quick_assign_v1.sql", import.meta.url));
const repository = read(new URL("./departmentPlanRepository.ts", import.meta.url));
const handlers = read(new URL("./departmentPlanHandlers.ts", import.meta.url));
const route = read(new URL("../app/api/planning/department/items/[itemId]/quick-assign/route.ts", import.meta.url));
const dialog = read(new URL("../components/DepartmentPlanQuickAssignDialog.tsx", import.meta.url));
const grid = read(new URL("../components/DepartmentPlanGrid.tsx", import.meta.url));
const detail = read(new URL("../components/DepartmentPlanItemDialog.tsx", import.meta.url));

test("quick assign uses the existing Plan link and one atomic RPC", () => {
  assert.match(migration, /api_quick_assign_department_plan_task_v1/);
  assert.match(migration, /from public\.department_plan_items[\s\S]*for update/);
  assert.match(migration, /api_assign_task_v2/);
  assert.match(migration, /linked_task_id = v_task\.id/);
  assert.match(migration, /linked_task_id is null/);
  assert.doesNotMatch(migration, /create table .*department_plan.*task/i);
});

test("quick assign preserves normal STANDARD Task semantics and Plan provenance", () => {
  assert.match(migration, /workflow_type[\s\S]*STANDARD|STANDARD[\s\S]*workflow_type/);
  assert.match(migration, /assignment_source[\s\S]*department_plan/);
  assert.match(migration, /'department_plan'/);
  assert.doesNotMatch(migration, /REPORT_ONLY/);
});

test("server contract accepts only compact assignment input", () => {
  assert.match(repository, /quickAssignTaskFromItem/);
  assert.match(repository, /api_quick_assign_department_plan_task_v1/);
  assert.match(handlers, /async function quickAssignTask/);
  assert.match(handlers, /scopeFor\(guard\.actor, plan\.data\.department_id\)/);
  assert.match(route, /departmentPlanHandlers\.quickAssignTask/);
  for (const field of ["assigneeId", "dueDate", "dueTime", "priority", "note"]) {
    assert.match(handlers + dialog, new RegExp(field));
  }
  for (const forbidden of ["creatorId", "workflowType", "reviewerId"]) {
    assert.doesNotMatch(dialog, new RegExp(forbidden));
  }
});

test("database enforcement blocks bypass and duplicate active assignments", () => {
  assert.match(migration, /api_assert_task_action\(p_actor_id, null, 'assign'\)/);
  assert.match(migration, /v_actor_department <> v_plan\.department_id/);
  assert.match(migration, /department_id = v_plan\.department_id/);
  assert.match(migration, /linked_task_id is not null[\s\S]*23505/);
  assert.match(migration, /revoke all on function[\s\S]*authenticated/);
  assert.match(migration, /grant execute on function[\s\S]*service_role/);
});

test("compact UI filters Plan department staff and exposes only quick fields", () => {
  assert.match(dialog, /person\.departmentId === item\.department_id/);
  for (const label of ["Người thực hiện", "Hạn hoàn thành", "Mức độ ưu tiên", "Ghi chú", "Hủy", "Giao việc"]) {
    assert.match(dialog, new RegExp(label));
  }
  assert.doesNotMatch(dialog, /CanonicalAssignmentForm|collaborator|watcher|attachment|recurrence/i);
  assert.match(grid + detail, /Giao việc nhanh/);
  assert.match(grid + detail, /Xem công việc/);
});

test("Plan status is derived from the linked Task", () => {
  assert.match(repository, /linked_task_status/);
  assert.match(grid + detail, /Đã giao/);
  assert.match(grid + detail, /Đang thực hiện/);
  assert.match(grid + detail, /Hoàn thành/);
  assert.match(grid + detail, /Đã hủy|Đã huỷ/);
});


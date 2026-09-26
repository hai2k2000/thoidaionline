import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (name) => readFileSync(new URL("./" + name, import.meta.url), "utf8");
const migration = read("../../supabase/migrations/20260926150000_department_plan_to_task_v1.sql");
const repository = read("departmentPlanRepository.ts");
const handlers = read("departmentPlanHandlers.ts");
const dialog = read("../components/DepartmentPlanItemDialog.tsx");
const route = read("../app/api/planning/department/items/[itemId]/route.ts");

test("uses the canonical Task creation RPC", () => {
  assert.match(migration, /api_assign_task_v2/);
  assert.match(repository, /api_create_department_plan_task/);
  assert.doesNotMatch(migration, /create table .*task/i);
});

test("locks the persisted item before conversion", () => {
  assert.match(migration, /from public\.department_plan_items[\s\S]*for update/);
  assert.match(migration, /where id = p_item_id/);
});

test("already-linked items resolve idempotently", () => {
  assert.match(migration, /if v_item\.linked_task_id is not null/);
  assert.match(migration, /select \* into v_task from public\.tasks/);
  assert.match(migration, /return v_task/);
});

test("the relationship remains one-to-one and non-destructive", () => {
  assert.match(migration, /linked_task_id[\s\S]*references public\.tasks\(id\) on delete restrict/);
  assert.match(migration, /update public\.department_plan_items[\s\S]*linked_task_id = v_task\.id/);
  assert.match(migration, /and linked_task_id is null/);
});

test("authorization covers plan scope and canonical Task authority", () => {
  assert.match(handlers, /scopeFor\(guard\.actor, plan\.data\.department_id\)/);
  assert.match(migration, /api_assign_task_v2/);
  assert.match(migration, /api_assert_task_action\(p_actor_id, null, 'assign'\)/);
  assert.match(migration, /Department plan item is outside actor scope/);
});

test("global roles and same-department managers remain supported", () => {
  assert.match(migration, /admin.*tong_bien_tap.*pho_tong_bien_tap/);
  assert.match(migration, /v_actor_department <> v_plan\.department_id/);
});

test("only assigned items are representable by the canonical Task model", () => {
  assert.match(migration, /v_item\.assignment_state <> 'assigned'/);
  assert.match(migration, /This assignment state cannot create a canonical Task/);
  assert.match(migration, /v_item\.assignee_id/);
});

test("canonical RPC revalidates active assignee and department", () => {
  assert.match(migration, /v_item\.assignee_id/);
  assert.match(migration, /v_plan\.department_id/);
  assert.match(migration, /api_assign_task_v2/);
});

test("maps title, description, requirements, department, and due date", () => {
  assert.match(migration, /v_item\.title/);
  assert.match(migration, /v_item\.description/);
  assert.match(migration, /v_item\.requirements/);
  assert.match(migration, /v_plan\.department_id/);
  assert.match(migration, /v_due_date :=/);
});

test("uses canonical Task default status and priority", () => {
  assert.match(migration, /'normal'/);
  assert.match(migration, /api_assign_task_v2/);
  assert.doesNotMatch(migration, /v_item\.work_status/);
});

test("records auditable Plan origin", () => {
  assert.match(migration, /'department_plan'/);
  assert.match(migration, /'create_task'/);
  assert.match(migration, /task_id.*v_task\.id/);
});

test("the API exposes one explicit POST action", () => {
  assert.match(route, /export async function POST/);
  assert.match(route, /departmentPlanHandlers\.createTask/);
  assert.match(handlers, /async function createTask\(request: Request, itemId: string\)/);
});

test("the UI requires confirmation and persisted state", () => {
  assert.match(dialog, /window\.confirm\("Tạo công việc chính thức/);
  assert.match(dialog, /disabled=\{saving \|\| dirty\}/);
  assert.match(dialog, /method: "POST"/);
  assert.match(dialog, /linkedTask/);
});

test("opening, saving, and editing do not implicitly create a Task", () => {
  const beforeAction = dialog.slice(0, dialog.indexOf("const createTask"));
  assert.doesNotMatch(beforeAction, /method: "POST"/);
  assert.doesNotMatch(beforeAction, /api_create_department_plan_task/);
});

test("linked state exposes the canonical Task detail", () => {
  assert.match(dialog, /Mở công việc/);
  assert.match(dialog, /href=\{"\/tasks\/" \+ linkedTask\.id\}/);
  assert.match(handlers, /linkedTask: linkedTask\.data/);
});

test("failed linkage is surfaced without client-side two-step mutation", () => {
  assert.match(handlers, /createTaskFromItem/);
  assert.doesNotMatch(dialog, /\/api\/tasks/);
  assert.doesNotMatch(dialog, /PATCH.*linked_task_id/);
});

test("migration is additive and preserves unrelated models", () => {
  assert.match(migration, /alter table public\.department_plan_items/);
  assert.doesNotMatch(migration, /drop table|truncate table|delete from/i);
  assert.doesNotMatch(migration, /personal_plan|work_schedules/i);
});

test("repository returns the linked Task through the server RPC", () => {
  assert.match(repository, /rpc\("api_create_department_plan_task"/);
  assert.match(repository, /p_actor_id: actorId/);
  assert.match(repository, /p_item_id: itemId/);
});

test("error mapping hides database details", () => {
  assert.match(handlers, /apiError\("forbidden", 403\)/);
  assert.match(handlers, /apiError\("invalid_request", 400\)/);
  assert.doesNotMatch(handlers, /error\.message.*apiJson/);
});

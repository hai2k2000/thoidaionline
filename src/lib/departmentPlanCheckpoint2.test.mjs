import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (name) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

test("repository keeps reads lazy and mutation creation race-safe", () => {
  const source = read("departmentPlanRepository.ts");
  const readMethod = source.slice(source.indexOf("async getPeriod"), source.indexOf("async listPlanItems"));
  assert.match(readMethod, /from\("department_plans"\)/);
  assert.doesNotMatch(readMethod, /api_get_or_create_department_plan/);
  assert.match(source, /getOrCreatePlanForMutation[\s\S]*rpc\("api_get_or_create_department_plan"/);
});

test("item persistence derives department from the parent plan", () => {
  const source = read("departmentPlanRepository.ts");
  assert.match(source, /department_id:\s*plan\.data\.department_id/);
  assert.doesNotMatch(source, /input\.department_id/);
  assert.match(source, /validateAssignee\(plan\.data\.department_id/);
});

test("handlers authorize parent scope before every item operation", () => {
  const source = read("departmentPlanHandlers.ts");
  assert.match(source, /getPlan\(id\)[\s\S]*scopeFor\(guard\.actor, plan\.data\.department_id\)/);
  assert.match(source, /linked_task_id.*department_id.*department_plan_id/);
  assert.match(source, /requireReadActor/);
  assert.match(source, /requireMutationActor/);
});

test("handlers use canonical periods and sanitized errors", () => {
  const source = read("departmentPlanHandlers.ts");
  assert.match(source, /getDepartmentPlanPeriod/);
  assert.match(source, /apiError\("forbidden", 403\)/);
  assert.match(source, /apiError\("not_found", 404\)/);
  assert.doesNotMatch(source, /error\.message.*apiJson/);
});

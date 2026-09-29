import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../../supabase/migrations/20260926140000_department_plans_v2.sql", import.meta.url), "utf8");
const sqlTest = readFileSync(new URL("../../supabase/tests/department_plan_v2_schema.sql", import.meta.url), "utf8");

test("checkpoint 1 creates only additive department plan tables", () => {
  assert.match(migration, /create table if not exists public\.department_plans/);
  assert.match(migration, /create table if not exists public\.department_plan_items/);
  assert.doesNotMatch(migration, /drop table|truncate table|delete from|alter table public\.(tasks|work_schedules)/i);
  assert.doesNotMatch(migration, /insert into public\.(tasks|work_schedules)/i);
});

test("weekly and monthly periods are canonical and unique", () => {
  assert.match(migration, /period_type in \('weekly', 'monthly'\)/);
  assert.match(migration, /extract\(isodow from period_start\) = 1/);
  assert.match(migration, /period_end = period_start \+ 6/);
  assert.match(migration, /period_start = date_trunc\('month', period_start\)::date/);
  assert.match(migration, /interval '1 month - 1 day'/);
  assert.match(migration, /unique \(department_id, period_type, period_start\)/);
});

test("items enforce state, parent department, and one linked task", () => {
  assert.match(migration, /assignment_state in \('unassigned', 'department_wide', 'assigned'\)/);
  assert.match(migration, /work_status in \('planned', 'in_progress', 'completed', 'cancelled'\)/);
  assert.match(migration, /foreign key \(department_plan_id, department_id\)/);
  assert.match(migration, /references public\.department_plans\(id, department_id\)/);
  assert.match(migration, /linked_task_id uuid unique references public\.tasks\(id\)/);
});

test("known period and item queries have dedicated indexes", () => {
  assert.match(migration, /constraint department_plans_period_unique/);
  assert.match(migration, /department_plan_items_plan_due_idx/);
  assert.match(migration, /department_plan_items_department_state_idx/);
  assert.match(migration, /department_plan_items_assignee_idx/);
  assert.doesNotMatch(migration, /department_plans_department_period_idx|department_plan_items_linked_task_idx/);
});

test("container creation uses one race-safe upsert contract", () => {
  assert.match(migration, /api_get_or_create_department_plan/);
  assert.match(migration, /on conflict \(department_id, period_type, period_start\)/);
  assert.match(migration, /do update set updated_at = public\.department_plans\.updated_at/);
  assert.doesNotMatch(migration, /if not exists\s*\(\s*select[\s\S]*insert into public\.department_plans/i);
});

test("SQL integration coverage includes every checkpoint 1 guard", () => {
  for (const marker of [
    "weekly uniqueness", "monthly uniqueness", "weekly and monthly plans must coexist", "departments must be independent",
    "weekly Monday guard", "weekly end guard", "monthly first-day guard", "monthly last-day guard",
    "invalid assignment enum guard", "invalid work status guard", "forged cross-department item guard",
    "linked task uniqueness guard", "task data changed", "personal plan data changed",
    "nullable assignee", "department-wide state", "assigned state",
  ]) assert.match(sqlTest, new RegExp(marker, "i"));
  assert.equal((sqlTest.match(/\\ir \.\.\/migrations\/20260926140000_department_plans_v2\.sql/g) ?? []).length, 2);
});

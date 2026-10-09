import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../../supabase/migrations/20261003120000_department_plan_duplicate_guard.sql", import.meta.url), "utf8");
const handlers = readFileSync(new URL("./departmentPlanHandlers.ts", import.meta.url), "utf8");
const actions = readFileSync(new URL("../components/DepartmentPlanActions.tsx", import.meta.url), "utf8");

 test("database identity covers department, type, start, and end", () => {
  assert.match(migration, /create unique index if not exists department_plans_period_identity_uidx/);
  assert.match(migration, /department_id, period_type, period_start, period_end/);
 });

 test("create RPC serializes duplicate requests and returns without replaying items", () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /if found then return v_plan; end if/);
  assert.match(migration, /api_create_department_plan_v2_legacy/);
  assert.match(migration, /api_create_department_plan_v2_result/);
 });

 test("candidate handler checks existing plans before scanning", () => {
  assert.match(handlers, /getPeriod\(scope\.departmentId, period\.periodType, period\.periodStart\)[\s\S]*existingPlan/);
  assert.match(handlers, /candidates: \[\]/);
 });

 test("create handlers return a friendly existing-plan context", () => {
  assert.match(handlers, /existingPlan: serializePlan\(existing\.data\)/);
  assert.match(handlers, /created: false/);
 });

 test("UI does not scan an already-loaded plan and offers open/close actions", () => {
  assert.match(actions, /if \(plan\) \{[\s\S]*openExisting\(plan\)/);
  assert.match(actions, /Kế hoạch kỳ này đã tồn tại\./);
  assert.match(actions, />Mở kế hoạch<|>Mở kế hoạch<\/button>/);
  assert.match(actions, />Đóng<|>Đóng<\/button>/);
  assert.match(actions, /departmentPlanUrl\(period\.periodType, period\.periodStart, departmentId\)/);
 });

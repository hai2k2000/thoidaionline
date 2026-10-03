import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(new URL("../../supabase/migrations/20261003100000_department_period_plan_v2.sql", import.meta.url), "utf8");

test("Department Period Plan V2 migration keeps Task canonical and enforces Task x period", () => {
  assert.match(sql, /department_plan_items_task_period_uidx/);
  assert.match(sql, /unique index[\s\S]*department_plan_id,linked_task_id/i);
  assert.match(sql, /period_relation/);
  assert.match(sql, /api_department_plan_candidates_v2/);
  assert.match(sql, /api_create_department_plan_v2/);
  assert.match(sql, /api_close_department_plan_v2/);
  assert.match(sql, /tasks_auto_link_department_plans/);
});

test("Department Period Plan V2 does not auto-link REPORT_ONLY or pending approval", () => {
  assert.match(sql, /workflow_type,'STANDARD'\)='REPORT_ONLY'/);
  assert.match(sql, /approval_required,false\) and new\.assignment_approved_at is null/);
});

test("DOCX import is preview-only and export uses real report rows", () => {
  const importRoute = readFileSync(new URL("../../src/app/api/planning/department/import/route.ts", import.meta.url), "utf8");
  const exportRoute = readFileSync(new URL("../../src/app/api/planning/department/reports/docx/route.ts", import.meta.url), "utf8");
  assert.match(importRoute, /persisted: false/);
  assert.match(exportRoute, /exportDepartmentPlanDocx/);
});

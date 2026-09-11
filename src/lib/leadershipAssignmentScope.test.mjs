import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("leadership assignment accepts mapped department heads", () => {
  const sql = read("../../supabase/migrations/20260830100000_fix_leadership_assignment_scope.sql");
  assert.match(sql, /ld\.code='leadership'/);
  assert.match(sql, /lower\(coalesce\(rr\.code,''\)\)='pho_tong_bien_tap'/);
  assert.match(sql, /lower\(coalesce\(jt\.code,''\)\)='truong_phong'/);
  assert.match(sql, /u\.department_id=p_department_id/);
  assert.match(sql, /api_assign_task_v2/);
});

test("department deputy assignment migration enables scoped task assignment", () => {
  const sql = read("../../supabase/migrations/20260911110000_enable_deputy_department_assignment.sql");
  assert.match(sql, /lower\(code\) = 'pho_truong_phong'/i);
  assert.match(sql, /can_assign_task = true/i);
  assert.match(sql, /can_view_department_tasks = true/i);
});

test("department deputy role is accepted as the assignment reviewer without relying on job title", () => {
  const sql = read("../../supabase/migrations/20260911180000_align_deputy_assignment_reviewer.sql");
  const reviewerGuard = sql.match(/or not exists\(\s*select 1[\s\S]*?Invalid assignee, reviewer or manager/);
  assert.ok(reviewerGuard, "reviewer validation block should exist");
  assert.match(reviewerGuard[0], /lower\(coalesce\(rr\.code,''\)\) in \('truong_phong','pho_truong_phong'\)/);
});

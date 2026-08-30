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

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = "supabase/migrations/20261031140000_duty_roster_status_fix.sql";
const revertPath = "scripts/production/duty-roster-status-fix-revert.sql";

test("duty roster status migration guards duty tasks and uses non-retryable errors", () => {
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(sql, /coalesce\(new\.task_category,''\)\s*<>\s*'duty'/);
  assert.doesNotMatch(sql, /errcode\s*=\s*'40001'/);
  assert.equal((sql.match(/errcode\s*=\s*'55000'/g) || []).length, 2);
});

test("duty roster data correction only resets untouched auto-started tasks", () => {
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(sql, /status\s*=\s*'in_progress'/);
  assert.match(sql, /coalesce\([^)]*progress_percent[^)]*,\s*0\)\s*=\s*0/);
  assert.match(sql, /not exists[\s\S]*task_status_events/);
  assert.match(sql, /not exists[\s\S]*duty_task_reviews/);
});

test("duty roster revert restores both production functions", () => {
  assert.equal(existsSync(revertPath), true);
  const sql = readFileSync(revertPath, "utf8");
  assert.match(sql, /create or replace function public\.api_save_monthly_duty_roster/i);
  assert.match(sql, /create or replace function public\.default_direct_assignment_status/i);
});
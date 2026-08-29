import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("assigned task approval requires a score for the current submission and clears returned scores", () => {
  const sql = read("../../supabase/migrations/20260829100000_require_fresh_task_score.sql");
  assert.match(sql, /p_decision='approve'[\s\S]*completion_submitted_at/);
  assert.match(sql, /s\.updated_at\s*>=\s*v_before\.completion_submitted_at/);
  assert.match(sql, /new\.status='done'[\s\S]*s\.updated_at\s*>=\s*new\.completion_submitted_at/);
  assert.match(sql, /delete from public\.task_completion_scores where task_id=p_task_id/);
  assert.match(sql, /new\.status='rejected'[\s\S]*delete from public\.task_completion_scores/);
  assert.match(sql, /completion_score_cleared/);
});

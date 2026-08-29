import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("admin task edits cannot bypass assigned completion freshness", () => {
  const sql = read("../../supabase/migrations/20260829130000_harden_admin_task_edit.sql");
  assert.match(sql, /p_status='pending_review'[\s\S]*Assigned completion must be submitted/);
  assert.match(sql, /p_status='done'[\s\S]*v_before\.status<>'pending_review'/);
  assert.match(sql, /s\.updated_at>=v_before\.completion_submitted_at/);
  assert.match(sql, /progress_percent=case when p_status='done' then 100/);
  assert.match(sql, /v_before\.status='done' and p_status<>'done'/);
  assert.match(sql, /delete from public\.task_completion_scores where task_id=p_task_id/);
});

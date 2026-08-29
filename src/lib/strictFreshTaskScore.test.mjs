import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("strict fresh-score correction rejects approval without a submission timestamp", () => {
  const sql = read("../../supabase/migrations/20260829110000_strict_fresh_task_score.sql");
  assert.match(sql, /new\.completion_submitted_at\s+is\s+null/);
  assert.match(sql, /v_before\.completion_submitted_at\s+is\s+null/);
  assert.match(sql, /s\.updated_at\s*>=\s*new\.completion_submitted_at/);
  assert.match(sql, /s\.updated_at\s*>=\s*v_before\.completion_submitted_at/);
});

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("assignment semantics migration is additive and preserves legacy origin", () => {
  const sql = read("../../supabase/migrations/20260924130000_task_assignment_semantics.sql");
  assert.match(sql, /add column if not exists assignment_source text not null default 'legacy_unknown'/i);
  assert.match(sql, /leadership_assigned/);
  assert.match(sql, /self_registered/);
  assert.match(sql, /before insert on public.tasks/i);
  assert.doesNotMatch(sql, /update\s+public\.tasks\s+set\s+assignment_source/i);
});

test("source UI and pending-review actions use structured origin", () => {
  const summary = read("../components/TaskCenterShell.tsx");
  const detail = read("../components/TaskDetailShell.tsx");
  const print = read("../components/WorkAssignmentPrintSheet.tsx");
  assert.match(summary, /assignmentSource/);
  assert.match(summary, /Tự đăng ký/);
  assert.match(summary, /Lãnh đạo giao/);
  assert.match(detail, /pending_review/);
  assert.match(print, /assignmentSourceLabel/);
});


test("standalone artifact metadata references assignment semantics migration", () => {
  const packageScript = read("../../scripts/package-standalone.mjs");
  const verifier = read("../../scripts/verify-standalone-artifact.mjs");
  assert.match(packageScript, /20260924130000_task_assignment_semantics\.sql/);
  assert.match(verifier, /20260924130000_task_assignment_semantics\.sql/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260911150000_lock_task_completion_scores.sql", "utf8");

test("completion scores are writable only through the scoring RPC", () => {
  assert.match(migration, /alter table public\.task_completion_scores enable row level security/);
  assert.match(migration, /revoke all on public\.task_completion_scores from public, anon, authenticated/);
  assert.match(migration, /grant select on public\.task_completion_scores to service_role/);
});

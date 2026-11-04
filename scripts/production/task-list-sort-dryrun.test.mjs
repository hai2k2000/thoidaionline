import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("task list sort dry-run is scoped, fail-closed, and behaviour-backed", () => {
  const script = readFileSync("scripts/production/task-list-sort-dryrun.sh", "utf8");
  for (const pattern of [
    /THOIDAI_TASK_LIST_SORT_DRYRUN_APPROVED/, /BUNDLE_DIR/, /TASK_LIST_SORT_DB_URL/, /safe-apply-migration\.sh/,
    /20261106120000_task_list_deadline_sort/, /task_list_deadline_sort_behaviour/, /trap cleanup EXIT/,
    /TASK_LIST_SORT_DRYRUN_RESULT=PASS/, /leftover dry-run container/,
  ]) assert.match(script, pattern);
  assert.doesNotMatch(script, /systemctl|docker system prune|docker volume prune|set -x/);
});

test("deadline sort migration uses generated stored columns and a supporting index", () => {
  const migration = readFileSync("supabase/migrations/20261106120000_task_list_deadline_sort.sql", "utf8");
  assert.match(migration, /list_closed boolean generated always as/i);
  assert.match(migration, /list_due_at timestamp generated always as/i);
  assert.match(migration, /list_priority_rank smallint generated always as/i);
  assert.match(migration, /stored/i);
  assert.match(migration, /tasks_list_deadline_order_idx/);
  assert.doesNotMatch(migration, /grant|revoke/i);
});

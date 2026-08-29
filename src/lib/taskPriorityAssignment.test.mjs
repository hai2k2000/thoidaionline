import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
test("assignment stores priority atomically in the creation RPC", () => {
  const form = read("../components/TaskAssignShell.tsx");
  const handler = read("./taskHandlerFactory.ts");
  const repository = read("./taskRepository.ts");
  const migration = read("../../supabase/migrations/20260821100000_atomic_task_assignment_priority.sql");
  assert.match(form, /priority:\s*"normal"/);
  assert.doesNotMatch(form, /priorityResponse|JSON\.stringify\(\{ priority: payload\.priority \}\)/);
  assert.match(handler, /body\?\.priority === undefined[\s\S]*\? "normal"/);
  assert.match(handler, /priority: assignmentPriority/);
  assert.match(repository, /p_priority:\s*input\.priority/);
  assert.match(migration, /api_assign_task_v2[\s\S]*p_priority text default 'normal'/);
  assert.match(migration, /task_type,start_date,evaluation_criteria,priority/);
  assert.match(migration, /recurrence_rule_id,priority/);
});

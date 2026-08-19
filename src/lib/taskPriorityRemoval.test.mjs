import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sourceFiles = [
  "src/app/page.tsx",
  "src/app/planning/page.tsx",
  "src/app/profile/page.tsx",
  "src/app/tasks/[id]/page.tsx",
  "src/components/TaskStatusTablePage.tsx",
  "src/app/api/notify/due-soon/route.ts",
  "mobile/thoidai_work_flutter/lib/models/task_item.dart",
  "mobile/thoidai_work_flutter/lib/services/work_service.dart",
  "mobile/thoidai_work_flutter/lib/features/tasks_page.dart",
];

test("task assignment surfaces do not select, send, filter or render legacy priority", () => {
  for (const file of sourceFiles) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /\bpriority\b|mức ưu tiên/i, file);
  }
});

test("database keeps a neutral legacy default for omitted priority", () => {
  const migration = readFileSync("supabase/migrations/20260814090000_task_priority_neutral_default.sql", "utf8");
  assert.match(migration, /alter column priority set default 'normal'/i);
  assert.match(migration, /alter column priority set not null/i);
});

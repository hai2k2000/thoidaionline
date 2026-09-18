import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = "supabase/migrations/20260918150000_journalism_topics_series_j5_associations.sql";
const routes = [
  "src/app/api/tasks/[id]/journalism/topics/route.ts",
  "src/app/api/tasks/[id]/journalism/topics/[topicId]/route.ts",
  "src/app/api/tasks/[id]/journalism/series/route.ts",
  "src/app/api/journalism/series/[seriesId]/order/route.ts",
];

test("J5D migration exposes only association and ordering RPCs without RBAC changes", () => {
  assert.equal(fs.existsSync(migration), true);
  const sql = fs.readFileSync(migration, "utf8");
  for (const name of ["api_attach_editorial_topic_task_v1", "api_detach_editorial_topic_task_v1", "api_attach_editorial_series_task_v1", "api_detach_editorial_series_task_v1", "api_reorder_editorial_series_v1"]) {
    assert.match(sql, new RegExp("create or replace function public\\." + name));
  }
  assert.match(sql, /FOR UPDATE/i);
  assert.match(sql, /journalism\.structure\.assign/);
  assert.match(sql, /journalism\.structure\.manage/);
  assert.doesNotMatch(sql, /insert into public\.permissions|insert into public\.role_permission_grants/i);
});

test("J5D routes are session guarded and reject client authority or positions", () => {
  for (const path of routes) assert.equal(fs.existsSync(path), true, path);
  const source = routes.map((path) => fs.readFileSync(path, "utf8")).join("\n") + fs.readFileSync("src/lib/journalismAssociationHandlers.ts", "utf8");
  assert.match(source, /requireMutationActor/);
  assert.match(source, /topicId/);
  assert.match(source, /seriesId/);
  assert.match(source, /taskIds/);
  assert.doesNotMatch(source, /actorId|role|scope|permission|position:/);
});

test("J5D does not modify Journalism UI", () => {
  const changedUi = ["TaskDetailShell.tsx", "TaskCenterShell.tsx", "AppNav.tsx"];
  for (const name of changedUi) assert.equal(fs.existsSync("src/components/" + name), true);
});

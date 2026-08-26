import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("completion scoring uses fixed 5-point choices and an editable automatic requirement score", async () => {
  const detail = await read("../components/TaskDetailShell.tsx");

  assert.match(detail, /\[5, 10, 15, 20\]\.map/);
  assert.match(detail, /setRequirementScore\(Number\(\(next\.filter\(Boolean\)\.length \* 60 \/ requirements\.length\)\.toFixed\(2\)\)\)/);
  assert.match(detail, /type="number" min=\{0\} max=\{60\}/);
  assert.match(detail, /requirementScore, collaborationScore, initiativeScore/);
});

test("completion scoring validates and persists the adjusted requirement score", async () => {
  const handler = await read("taskHandlerFactory.ts");
  const repository = await read("taskRepository.ts");
  const migration = await read("../../supabase/migrations/20260826090000_editable_requirement_score.sql");

  assert.match(handler, /requirementScore < 0 \|\| requirementScore > 60/);
  assert.match(handler, /\[5, 10, 15, 20\]\.includes\(score\)/);
  assert.match(repository, /p_requirement_score: requirementScore/);
  assert.match(migration, /p_requirement_score numeric/);
  assert.match(migration, /p_collaboration_score not in \(5,10,15,20\)/);
  assert.match(migration, /p_initiative_score not in \(5,10,15,20\)/);
  assert.match(migration, /p_task_id,p_actor_id,p_requirement_results,p_requirement_score/);
});

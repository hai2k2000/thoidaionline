import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("shared rubric configuration is Admin-only and versioned through server APIs", () => {
  const page = read("../app/configuration/evaluation-rubrics/page.tsx");
  const shell = read("./EvaluationRubricShell.tsx");
  const route = read("../app/api/evaluation-rubrics/route.ts");
  assert.match(page, /role_code\s*!==\s*["']admin["']/);
  assert.match(page, /can_manage_rubrics/);
  assert.match(route, /evaluationHandlers/);
  assert.doesNotMatch(page + route, /@\/lib\/supabase/);
  for (const action of ["clone", "update", "publish", "retire"]) {
    assert.match(shell + route, new RegExp(action, "i"), `${action} workflow missing`);
  }
});

test("legacy task evaluation view redirects to canonical personnel evaluation", () => {
  const page = read("../app/tasks/page.tsx");
  const shell = read("./TaskCenterShell.tsx");
  assert.match(page, /rawParams\.view\s*===\s*["']evaluations["']/);
  assert.match(page, /redirect\(`\/evaluations/);
  assert.doesNotMatch(page, /@\/lib\/supabase/);
  assert.doesNotMatch(shell, /EmployeeEvaluationShell/);
  assert.doesNotMatch(shell, /tasks\?view=evaluations/);
});

test("Phase 7 workflow stays behind same-origin session routes and service-role RPCs", () => {
  const route = read("../app/api/evaluations/[id]/route.ts");
  const handlers = read("../lib/evaluationHandlers.ts");
  const repository = read("../lib/evaluationRepository.ts");
  const sql = read("../../supabase/migrations/20260817090000_phase7_shared_rubric_evaluation.sql");
  assert.match(route, /evaluationHandlers/);
  assert.match(handlers, /requireMutationActor/);
  assert.match(repository, /server-only/);
  assert.match(sql, /api_submit_self_evaluation/);
  assert.match(sql, /api_submit_manager_evaluation/);
  assert.match(sql, /api_publish_tbt_evaluation/);
  assert.match(sql, /rubric_snapshot/);
  assert.match(sql, /manager_id/);
  assert.match(sql, /from public,anon,authenticated/);
  assert.doesNotMatch(sql, /department.*rubric|rubric.*department/i);
});

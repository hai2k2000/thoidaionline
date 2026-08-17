import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { resolveTaskCenterView } from "./taskCenterView.ts";

test("Task Center defaults to work and gates the evaluation view", () => {
  assert.equal(resolveTaskCenterView(undefined, false), "work");
  assert.equal(resolveTaskCenterView("work", false), "work");
  assert.equal(resolveTaskCenterView("evaluations", false), "work");
  assert.equal(resolveTaskCenterView("evaluations", true), "evaluations");
  assert.equal(resolveTaskCenterView("unknown", true), "work");
  assert.equal(resolveTaskCenterView(["evaluations"], true), "work");
});

test("Task Center page is server-session scoped and never imports browser Supabase", () => {
  const page = fs.readFileSync(
    new URL("../app/tasks/page.tsx", import.meta.url),
    "utf8",
  );
  const shell = fs.readFileSync(
    new URL("../components/TaskCenterShell.tsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /await getSessionUser\(\)/);
  assert.match(page, /redirect\("\/login"\)/);
  assert.match(page, /can_evaluate_step1/);
  assert.match(page, /can_evaluate_step2/);
  assert.doesNotMatch(page, /@\/lib\/supabase/);
  assert.doesNotMatch(shell, /@\/lib\/supabase/);
  assert.match(shell, /\/tasks\?view=work/);
  assert.match(shell, /\/tasks\?view=evaluations/);
  assert.match(shell, /canViewEvaluations/);
});

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("Phase 8 migration removes browser table access and keeps service-role access", () => {
  const sql = read("../../supabase/migrations/20260817100000_phase8_rls_hardening.sql");
  assert.match(sql, /revoke all privileges[\s\S]*from public,anon,authenticated/i);
  assert.match(sql, /grant select,insert,update,delete[\s\S]*to service_role/i);
  assert.match(sql, /drop policy/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /api_save_task_evaluation_checkpoint/);
  assert.match(sql, /api_report_task_progress/);
  assert.match(sql, /feature_not_supported/);
});

test("canonical task/evaluation browser bundles never import the anonymous Supabase client", () => {
  for (const path of [
    "../app/tasks/page.tsx",
    "../components/TaskCenterShell.tsx",
    "../components/TaskDetailShell.tsx",
    "../components/TaskAssignShell.tsx",
    "../components/EmployeeEvaluationShell.tsx",
    "../components/EvaluationRubricShell.tsx",
  ]) {
    assert.doesNotMatch(read(path), /@\/lib\/supabase|createClient\(/, path);
  }
});

test("legacy 1-10 mutation API is retired and hardening runbook documents rollback", () => {
  const handlers = read("./taskHandlerFactory.ts");
  const runbook = read("../../docs/PHASE8_RLS_HARDENING_RUNBOOK.md");
  assert.match(handlers, /legacy_evaluation_retired/);
  assert.match(runbook, /rollback/i);
  assert.match(runbook, /session_epoch/i);
  assert.match(runbook, /service_role/);
});

test("legacy browser-data pages redirect to server-only replacements", () => {
  const proxy = read("../proxy.ts");
  const account = read("../app/account/page.tsx");
  assert.match(proxy, /\/profile/);
  assert.match(proxy, /\/account/);
  assert.match(proxy, /\/users/);
  assert.match(account, /getSessionUser/);
  assert.doesNotMatch(account, /@\/lib\/supabase|createClient\(/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name) => {
  try { return readFileSync(new URL(name, import.meta.url), "utf8"); }
  catch { return ""; }
};
const repository = read("./personalWeeklyReportRepository.ts");
const service = read("./personalWeeklyReportService.ts");

test("loads only the authenticated employee and ignores client employee IDs", () => {
  assert.match(service, /requireReadActor\(\)/);
  assert.match(service, /requireMutationActor\(\)/);
  assert.match(service, /actor\.id/);
  assert.doesNotMatch(service, /body\.(?:userId|employeeId)|searchParams\.get\(["'](?:userId|employeeId)/i);
  assert.match(repository, /employee_id.*actorId|eq\(["']employee_id["'],\s*actorId/);
});

test("aggregates canonical tasks, assignees, department plan links, and report-only rows", () => {
  assert.match(repository, /from\(["']tasks["']\)/);
  assert.match(repository, /task_assignees/);
  assert.match(repository, /department_plan_items/);
  assert.match(repository, /workflow_type/);
  assert.match(repository, /REPORT_ONLY/);
  assert.match(repository, /dedupePersonalWeeklyTasks/);
  assert.match(repository, /watcher/);
});

test("cross-department participants remain eligible before actor filtering", () => {
  const query = repository.match(/async function getCanonicalRows\([\s\S]*?\n}\n/)?.[0] ?? "";
  assert.doesNotMatch(query, /\.eq\(["']department_id["'],\s*departmentId\)/);
  assert.match(query, /taskRows\([^;]*actorId/);
});

test("reads recurrence metadata from tasks, not department plan items", () => {
  assert.match(repository, /id,title,[^\n]*recurrence_rule_id/);
  assert.doesNotMatch(repository, /department_plan_items[^\n]*recurrence_rule_id/);
  assert.match(repository, /task_recurrence_rules\(active,starts_on,ends_on,next_scheduled_for\)/);
});

test("reuses existing Personal Plan work_schedules proposals without creating tasks", () => {
  assert.match(repository, /workScheduleRepository\.listPersonal/);
  assert.match(repository, /work_schedules|schedule_scope/);
  assert.doesNotMatch(repository, /api_create_task|api_assign_task|insert\([\s\S]*tasks/i);
});

test("loads bounded history newest first", () => {
  assert.match(repository, /period_start.*desc|order\(["']period_start["'],\s*\{\s*ascending:\s*false/);
  assert.match(repository, /PERSONAL_WEEKLY_HISTORY_LIMIT/);
});

test("save and complete call the exact server RPC signatures with actor-derived employee", () => {
  assert.match(repository, /api_save_personal_weekly_report/);
  assert.match(repository, /api_complete_personal_weekly_report/);
  assert.match(repository, /p_actor/);
  assert.match(repository, /p_employee/);
  assert.match(service, /savePersonalWeeklyDraft/);
  assert.match(service, /completePersonalWeeklyReport/);
  assert.match(service, /snapshot|build.*Snapshot/i);
});

test("completed reports read snapshot data and remain idempotent", () => {
  assert.match(repository, /status.*COMPLETED|COMPLETED.*status/);
  assert.match(repository, /snapshot_payload/);
  assert.match(service, /COMPLETED/);
  assert.match(service, /snapshot/);
  assert.match(repository, /if \(report\?\.status === "COMPLETED"\)/);
  assert.match(repository, /employee:\s*frozen\.employee/);
  assert.match(service, /employee:\s*loaded\.employee \? \{[\s\S]*?full_name:/);
});

test("maps repository and RPC failures through consistent safe responses", () => {
  assert.match(service, /rpcFailure|apiError/);
  assert.match(service, /invalid_request|forbidden|not_found/);
});

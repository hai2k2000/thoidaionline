import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("load model exposes addable current rows and Quick Report capability", () => {
  const repository = read("./personalWeeklyReportRepository.ts");
  assert.match(repository, /addableCurrentRows/);
  assert.match(repository, /filterPersonalWeeklyAddableRows/);
  assert.match(repository, /draft_payload/);
  assert.match(repository, /excludedTaskIds/);
});

test("candidate query remains actor-scoped by canonical participation and excludes cancelled tasks", () => {
  const repository = read("./personalWeeklyReportRepository.ts");
  assert.match(repository, /actorParticipates\(task, actorId\)/);
  assert.match(repository, /task\.status === ["']cancelled["']/);
  assert.match(repository, /assignment_role.*watcher|watcher.*assignment_role/);
});

test("draft mutation validates current rows against server-loaded canonical candidates", () => {
  const service = read("./personalWeeklyReportService.ts");
  assert.match(service, /validatePersonalWeeklyCurrentRows/);
  assert.match(service, /getPersonalWeeklyReport/);
  assert.match(service, /actorId/);
  assert.doesNotMatch(service, /body\.(?:userId|employeeId|user_id|employee_id)/);
});

test("sudden work reuses the existing Quick Report handler and enforces report period", () => {
  const route = read("../app/api/reports/weekly/add-work/route.ts");
  assert.match(route, /taskHandlers\.quickReport/);
  assert.match(route, /task\.quick_report\.create/);
  assert.match(route, /startDate.*period|period.*startDate/s);
  assert.match(route, /requireMutationActor/);
  assert.doesNotMatch(route, /userId|employeeId|actorId/);
});

test("the add-work route does not create Tasks directly or expose a generic assignment path", () => {
  const route = read("../app/api/reports/weekly/add-work/route.ts");
  assert.doesNotMatch(route, /from\(["']tasks["']\).*insert|api_assign_task|STANDARD/);
});

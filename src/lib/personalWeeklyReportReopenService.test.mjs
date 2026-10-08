import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const repository = readFileSync(new URL("./personalWeeklyReportRepository.ts", import.meta.url), "utf8");
const service = readFileSync(new URL("./personalWeeklyReportService.ts", import.meta.url), "utf8");
const model = readFileSync(new URL("./personalWeeklyReport.ts", import.meta.url), "utf8");

test("reopen repository maps only actor, report and reason to the RPC", () => {
  assert.match(repository, /api_reopen_personal_weekly_report/);
  assert.match(repository, /p_actor:\s*actorId/);
  assert.match(repository, /p_report_id:\s*reportId/);
  assert.match(repository, /p_reason:\s*reason/);
  const reopen = repository.match(/api_reopen_personal_weekly_report[\s\S]*?\n}\n/)?.[0] ?? "";
  assert.doesNotMatch(reopen, /p_employee|employeeId|userId/);
});

test("reopen service trims and validates reason before calling repository", () => {
  assert.match(service, /reason\.trim\(\)/);
  assert.match(service, /5.*500|500.*5/);
  assert.match(service, /requireMutationActor\(\)/);
});

test("version model and load expose bounded, snapshot-only history", () => {
  for (const field of ["id", "report_id", "version_no", "employee_id", "department_id", "period_start", "period_end", "snapshot_payload", "difficulties", "completed_by", "completed_at", "created_at"]) {
    assert.match(model + repository, new RegExp(field));
  }
  assert.match(repository, /versionHistory|versions/);
  assert.match(repository, /limit\(PERSONAL_WEEKLY_HISTORY_LIMIT\)/);
  assert.match(repository, /snapshotRows/);
});

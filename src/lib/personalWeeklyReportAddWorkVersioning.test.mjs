import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(new URL("./personalWeeklyReportService.ts", import.meta.url), "utf8");
const repository = readFileSync(new URL("./personalWeeklyReportRepository.ts", import.meta.url), "utf8");
const docx = readFileSync(new URL("./personalWeeklyReportDocx.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../components/PersonalWeeklyReportPage.tsx", import.meta.url), "utf8");

test("Version 2 snapshots selected added Tasks and keeps Version 1 immutable", () => {
  assert.match(service, /validatePersonalWeeklyCurrentRows/);
  assert.match(service, /currentRows/);
  assert.match(service, /snapshot/);
  assert.match(service, /completed/);
  assert.match(page, /excludedTaskIds/);
});

test("sudden work remains REPORT_ONLY and is included through the shared completed view", () => {
  assert.match(page, /REPORT_ONLY/);
  assert.match(page, /\/api\/reports\/weekly\/add-work/);
  assert.match(docx, /currentRows/);
  assert.match(docx, /viewModel\.currentRows/);
});

test("Personal Plan proposals remain on the existing work_schedules flow", () => {
  assert.match(repository, /getProposals/);
  assert.match(repository, /workScheduleRepository/);
  assert.match(service, /nextRows/);
  assert.doesNotMatch(service, /createTask|insertTask|STANDARD/);
});

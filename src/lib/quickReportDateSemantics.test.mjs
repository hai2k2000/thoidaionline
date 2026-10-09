import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Quick Report UI and both DOCX exports use the shared date-only formatter", () => {
  const summaryUi = read("../components/PersonalQuickReportSummary.tsx");
  const summaryDocx = read("./quickReportPersonalSummaryDocx.ts");
  const weeklyDocx = read("./personalWeeklyReportDocx.ts");
  assert.match(summaryUi, /formatDateOnlyVN/);
  assert.match(summaryDocx, /formatDateOnlyVN/);
  assert.match(weeklyDocx, /formatDateOnlyVN/);
});

test("summary derives actual completion from Vietnam business timestamp and keeps deadline separate", () => {
  const repository = read("./quickReportPersonalSummaryRepository.ts");
  const weeklyRepository = read("./personalWeeklyReportRepository.ts");
  assert.match(repository, /completionDateFromTaskTimestamp\(row\.completed_at\)/);
  assert.doesNotMatch(repository, /completed_at\.slice\(0, 10\)/);
  assert.match(weeklyRepository, /completionDate: task\.workflow_type === "REPORT_ONLY"/);
  assert.match(weeklyRepository, /dueDate: task\.due_date/);
});

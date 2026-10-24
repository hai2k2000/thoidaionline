import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync(new URL("./personalWeeklyReportRepository.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../components/PersonalWeeklyReportPage.tsx", import.meta.url), "utf8");

test("weekly candidates scope actor before pagination", () => {
  assert.match(repository, /owner_id\.eq\.\$\{actorId\},assignee_id\.eq\.\$\{actorId\}/);
  assert.match(repository, /from\("task_assignees"\)[\s\S]*?eq\("user_id", actorId\)/);
  assert.match(repository, /queryFactory\(\)\.range\(offset, offset \+ PERSONAL_WEEKLY_TASK_PAGE_SIZE - 1\)/);
  assert.doesNotMatch(repository, /tasks[\s\S]*?\.limit\(2000\)/);
});

test("weekly candidate scope preserves REPORT_ONLY boundaries and excludes cancelled work", () => {
  assert.match(repository, /task\.workflow_type === "REPORT_ONLY"[\s\S]*?task\.report_work_date >= period\.start && task\.report_work_date < period\.end/);
  assert.match(repository, /\.neq\("status", "cancelled"\)/);
  assert.match(repository, /assignment_role.*watcher|watcher.*assignment_role/);
});

test("weekly picker can refresh and shows selected work instead of hiding it", () => {
  assert.match(page, /refreshAvailableRows/);
  assert.match(page, /Làm mới/);
  assert.match(page, /Đã có trong báo cáo/);
  assert.doesNotMatch(page, /addableRows = .*filter\(\(row\) => !currentRows/);
});

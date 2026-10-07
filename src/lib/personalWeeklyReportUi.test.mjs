import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("weekly report route loads the authenticated employee view model", () => {
  const page = source("../app/reports/weekly/page.tsx");
  assert.match(page, /getSessionUser/);
  assert.match(page, /loadPersonalWeeklyReport/);
  assert.match(page, /PersonalWeeklyReportPage/);
  assert.match(page, /redirect\("\/login"\)/);
});

test("employee navigation exposes the Báo cáo tuần entry without a new permission", () => {
  const navigation = source("../components/phase2Navigation.ts");
  const appNav = source("../components/AppNav.tsx");
  assert.match(navigation, /"weekly-report"/);
  assert.match(navigation, /\/reports\/weekly/);
  assert.match(navigation, /{ id: "weekly-report", href: "\/reports\/weekly" }/);
  assert.match(appNav, /"weekly-report": "Báo cáo tuần"/);
  assert.doesNotMatch(navigation, /canAccessWeeklyReport/);
});

test("weekly report page renders the three employee sections and empty state", () => {
  const component = source("../components/PersonalWeeklyReportPage.tsx");
  for (const heading of ["Kết quả công việc trong tuần", "Kế hoạch tuần tới", "Khó khăn, kiến nghị"]) {
    assert.match(component, new RegExp(heading));
  }
  assert.match(component, /Chưa có công việc trong kỳ này/);
  assert.match(component, /overflow-x-auto/);
  assert.match(component, /md:hidden/);
});

test("draft, completion, history, Word export, and Personal Plan proposal flow are wired", () => {
  const component = source("../components/PersonalWeeklyReportPage.tsx");
  assert.match(component, /Lưu nháp/);
  assert.match(component, /Hoàn thành báo cáo/);
  assert.match(component, /Xuất Word/);
  assert.match(component, /window\.confirm/);
  assert.match(component, /\/api\/reports\/weekly/);
  assert.match(component, /\/api\/reports\/weekly\/complete/);
  assert.match(component, /\/api\/work-schedule\/personal/);
  assert.match(component, /Lịch sử báo cáo/);
  assert.match(component, /proposal|đề xuất/i);
});

test("completed reports keep snapshot rows read-only while drafts retain editable commentary", () => {
  const component = source("../components/PersonalWeeklyReportPage.tsx");
  assert.match(component, /status\s*===\s*["']COMPLETED["']/);
  assert.match(component, /disabled=\{completed\}/);
  assert.match(component, /resultText|commentary/);
});

test("reloaded drafts preserve intentionally empty selections and commentary", () => {
  const component = source("../components/PersonalWeeklyReportPage.tsx");
  assert.match(component, /hasOwnProperty\.call\(savedDraft, ["']currentRows["']\)/);
  assert.match(component, /hasOwnProperty\.call\(savedDraft, ["']nextRows["']\)/);
  assert.match(component, /hasOwnProperty\.call\(savedDraft, ["']difficulties["']\)/);
  assert.doesNotMatch(component, /savedDraft\?\.nextRows\?\.length \?/);
  assert.doesNotMatch(component, /savedDraft\?\.currentRows\?\.length \?/);
});

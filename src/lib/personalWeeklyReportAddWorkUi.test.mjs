import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../components/PersonalWeeklyReportPage.tsx", import.meta.url), "utf8");

test("A: draft and reopened report expose the add-work action", () => {
  assert.match(component, /Thêm công việc/);
  assert.match(component, /reopened/);
  assert.match(component, /addableCurrentRows/);
});

test("B/C: existing Task mode supports multi-select and duplicate-free local additions", () => {
  assert.match(component, /Chọn từ công việc đã có/);
  assert.match(component, /type="checkbox"/);
  assert.match(component, /selectedAddable|selectedTaskIds|addableCurrentRows/);
  assert.match(component, /Không có công việc phù hợp|đã có trong báo cáo/);
});

test("E/F: sudden-work mode is permission-gated and uses the REPORT_ONLY add-work route", () => {
  assert.match(component, /canCreateQuickReport/);
  assert.match(component, /Thêm việc phát sinh/);
  assert.match(component, /\/api\/reports\/weekly\/add-work/);
  assert.match(component, /REPORT_ONLY|Việc phát sinh/);
  assert.match(component, /response\.json/);
  assert.match(component, /setCurrentRows/);
  assert.doesNotMatch(component, /Đã thêm việc phát sinh[^\n]+window\.location\.reload/);
});

test("G: removing work changes only draft selection and does not call task mutation APIs", () => {
  assert.match(component, /Bỏ khỏi báo cáo/);
  assert.match(component, /excludedTaskIds/);
  assert.doesNotMatch(component, /cancel.*task|delete.*task|\/api\/tasks\//i);
});

test("completed and historical report rows remain read-only without add-work controls", () => {
  assert.match(component, /disabled=\{completed \|\| historical\}/);
  assert.match(component, /!completed && !historical/);
});

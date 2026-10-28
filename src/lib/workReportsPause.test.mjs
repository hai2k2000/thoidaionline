import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("central pause flag exports the shared message and navigation ids", () => {
  const source = read("lib/workReportsPause.ts");
  assert.match(source, /export const WORK_REPORTS_PAUSED\s*=\s*true/);
  assert.match(source, /PAUSED_WORK_REPORT_NAV_IDS\s*=\s*\[\s*["']work-report["']\s*,\s*["']weekly-report["']\s*\]\s*as const/);
  assert.match(source, /WORK_REPORTS_PAUSED_MESSAGE/);
  assert.match(source, /workReportsPausedResponse/);
});

test("navigation keeps source items but filters paused reports", () => {
  const source = read("components/phase2Navigation.ts");
  assert.match(source, /WORK_REPORTS_PAUSED/);
  assert.match(source, /PAUSED_WORK_REPORT_NAV_IDS/);
  assert.match(source, /filter\(/);
  assert.match(source, /id:\s*["']work-report["'][^\n]*href:\s*["']\/reports\/work["']/);
  assert.match(source, /id:\s*["']weekly-report["'][^\n]*href:\s*["']\/reports\/weekly["']/);
});

test("report APIs guard every exported handler before service or auth work", () => {
  const files = [
    "app/api/reports/work/route.ts",
    "app/api/reports/weekly/route.ts",
    "app/api/reports/weekly/add-work/route.ts",
    "app/api/reports/weekly/complete/route.ts",
    "app/api/reports/weekly/docx/route.ts",
    "app/api/reports/weekly/reopen/route.ts",
  ];
  let handlers = 0;
  for (const file of files) {
    const source = read(file);
    for (const match of source.matchAll(/export async function\s+(\w+)\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/g)) {
      handlers += 1;
      const body = match[2].trimStart();
      assert.match(body, /^if \(WORK_REPORTS_PAUSED\) return workReportsPausedResponse\(\);/);
    }
  }
  assert.equal(handlers, 7);
});

test("report pages pause after login check while retaining original loaders", () => {
  for (const [file, loader] of [
    ["app/reports/work/page.tsx", "loadWorkReport"],
    ["app/reports/weekly/page.tsx", "loadPersonalWeeklyReport"],
  ]) {
    const source = read(file);
    const login = source.indexOf('if (!user) redirect("/login");');
    const pause = source.indexOf("if (WORK_REPORTS_PAUSED)");
    assert.ok(login >= 0, `${file} keeps login check`);
    assert.ok(pause > login, `${file} pauses after login check`);
    assert.match(source, new RegExp(loader));
    assert.match(source, /WorkReportsPausedNotice/);
  }
});

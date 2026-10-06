import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const workspace = readFileSync(new URL("../components/QuickReportWorkspace.tsx", import.meta.url), "utf8");

test("quick report page exposes create and personal summary views", () => {
  assert.match(workspace, /PersonalQuickReportSummary/);
});

test("quick report UI keeps existing create flow and adds bounded summary filters", () => {
  const summary = readFileSync(new URL("../components/PersonalQuickReportSummary.tsx", import.meta.url), "utf8");
  assert.match(workspace, /Báo việc phát sinh/);
  assert.match(summary, /Tổng hợp việc phát sinh/);
  assert.match(summary, /Tuần/);
  assert.match(summary, /Tháng/);
  assert.match(summary, /Xuất báo cáo Word/);
});

test("summary loading state is derived without synchronous effect updates", () => {
  const summary = readFileSync(new URL("../components/PersonalQuickReportSummary.tsx", import.meta.url), "utf8");
  assert.match(summary, /const busy = !loadedQueryKey \|\| loadedQueryKey !== queryKey/);
  assert.doesNotMatch(summary, /setBusy\(true\); setError\(""\)/);
});

test("Word export stays disabled until the current filter has loaded", () => {
  const summary = readFileSync(new URL("../components/PersonalQuickReportSummary.tsx", import.meta.url), "utf8");
  assert.match(summary, /payload && !busy && payload\.report\.total/);
});
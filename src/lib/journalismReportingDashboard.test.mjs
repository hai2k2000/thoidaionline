import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { deriveJournalismReportingMetrics } from "./journalismReportingMetrics.mjs";
import { parseJournalismReportingSearchParams } from "./journalismReportingFilters.mjs";
import { canUseReportingDepartment } from "./journalismReportingScope.mjs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("reporting filters use a bounded Vietnam-month default and allowlisted values", () => {
  const query = parseJournalismReportingSearchParams(new URLSearchParams({ status: "done", verificationStatus: "stale", department: "bad" }), new Date("2026-09-19T02:00:00Z"));
  assert.deepEqual(query, { fromDate: "2026-09-01", toDate: "2026-09-19", departmentId: null, assigneeId: null, topicId: null, seriesId: null, status: "done", publicationStatus: null, verificationStatus: "stale" });
  assert.equal(parseJournalismReportingSearchParams(new URLSearchParams({ from: "2026-09-20", to: "2026-09-01" }), new Date("2026-09-19T02:00:00Z")).fromDate, "2026-09-01");
});

test("global metrics count each task once while Topic/Series associations remain distinct", () => {
  const report = (status, publishedAt) => ({ verification_status: status, published_title: "Bài", published_at: publishedAt, reporter: { full_name: "Reporter" }, publication_url: "https://example.com/story" });
  const rows = [
    { id: "1", title: "A", status: "in_progress", due_date: "2026-09-18", assignee_id: "u1", assignee: { full_name: "Một" }, department_id: "d1", department: { name: "Phòng Một" }, topics: [{ id: "t1", name: "Topic 1" }, { id: "t1", name: "Topic 1" }], series: [{ id: "s1", name: "Series 1" }, { id: "s2", name: "Series 2" }], report: report("verified", "2026-09-18T01:00:00Z") },
    { id: "2", title: "B", status: "done", due_date: "2026-09-01", assignee_id: "u2", assignee: { full_name: "Hai" }, department_id: "d1", department: { name: "Phòng Một" }, topics: [{ id: "t1", name: "Topic 1" }], series: [], report: report("stale", "2026-09-17T01:00:00Z") },
    { id: "3", title: "C", status: "blocked", due_date: "2026-09-17", assignee_id: null, assignee: null, department_id: "d2", department: { name: "Phòng Hai" }, topics: [], series: [], report: null },
  ];
  const metrics = deriveJournalismReportingMetrics(rows, 3, "2026-09-19", { recent: 15, attention: 20 });
  assert.equal(metrics.totalTasks, 3);
  assert.equal(metrics.reportedPublications, 2);
  assert.equal(metrics.unreportedTasks, 1);
  assert.equal(metrics.verificationVerified, 1);
  assert.equal(metrics.verificationStale, 1);
  assert.equal(metrics.overdue, 2);
  assert.equal(metrics.byTopic.find((row) => row.id === "t1").tasks, 2);
  assert.equal(metrics.bySeries.find((row) => row.id === "s1").tasks, 1);
  assert.equal(metrics.bySeries.find((row) => row.id === "s2").tasks, 1);
  assert.equal(metrics.attention.length, 2);
});

test("verification states and zero-data behavior stay explicit", () => {
  const metrics = deriveJournalismReportingMetrics([], 0, "2026-09-19");
  assert.deepEqual(metrics, { totalTasks: 0, reportedPublications: 0, unreportedTasks: 0, verificationVerified: 0, verificationRejected: 0, verificationStale: 0, verificationUnverified: 0, overdue: 0, byAssignee: [], byDepartment: [], byTopic: [], bySeries: [], recentPublications: [], attention: [] });
});

test("department reporting filters fail closed outside the actor's Task scope", () => {
  const permissions = { can_view_department_tasks: true };
  assert.equal(canUseReportingDepartment({ roleCode: "truong_phong", departmentId: "department-a", departmentCode: "content", permissions }, "department-a"), true);
  assert.equal(canUseReportingDepartment({ roleCode: "truong_phong", departmentId: "department-a", departmentCode: "other", permissions }, "department-a"), false);
  assert.equal(canUseReportingDepartment({ roleCode: "phong_vien", departmentId: "department-a", departmentCode: "content", permissions: { can_view_department_tasks: false } }, "department-a"), false);
  assert.equal(canUseReportingDepartment({ roleCode: "admin", departmentId: null, departmentCode: null, permissions: {} }, "department-b"), true);
});

test("reporting repository reuses Task scope and has bounded server-side read architecture", () => {
  const repository = read("./journalismReportingRepository.ts");
  assert.match(repository, /getTaskScopeTerms/);
  assert.match(repository, /canUseReportingDepartment/);
  assert.match(repository, /status !== "cancelled"/);
  assert.match(repository, /journalism_task_details!inner/);
  assert.match(repository, /journalism_publication_reports/);
  assert.match(repository, /journalism_publication_verifications/);
  assert.match(repository, /department:departments!inner\(code,name\)/);
  assert.match(repository, /eq\("departments\.code", "content"\)/);
  assert.match(repository, /REPORTING_DEFAULT_LIMIT - 1/);
  assert.match(repository, /created_at/);
  assert.doesNotMatch(repository, /insert\(|update\(|delete\(|\.rpc\(/);
});

test("dashboard is read-only, scoped at the server page, and keeps CMS disconnected", () => {
  const page = read("../app/journalism/reports/page.tsx");
  const dashboard = read("../components/JournalismReportingDashboard.tsx");
  assert.match(page, /getSessionUser/);
  assert.match(page, /loadJournalismReporting/);
  assert.match(dashboard, /Cần chú ý/);
  assert.match(dashboard, /href=\{`\/tasks\/\$\{row\.taskId\}`\}/);
  assert.match(dashboard, /target="_blank" rel="noreferrer"/);
  assert.doesNotMatch(dashboard, /onClick=|method:\s*["'](?:POST|PUT|DELETE)|MasterCMS|CMS status|fetch\(/);
});

test("J6F navigation entry uses the existing sidebar model", () => {
  const navigation = read("../components/phase2Navigation.ts");
  const appNav = read("../components/AppNav.tsx");
  assert.match(navigation, /journalism-reports/);
  assert.match(navigation, /\/journalism\/reports/);
  assert.match(appNav, /Báo cáo nghiệp vụ báo chí/);
});

test("J6F documentation records migration dependency and deferred CMS checkpoints", () => {
  const documentation = read("../../JOURNALISM_J6F_REPORTING_DASHBOARD.md");
  assert.match(documentation, /J6D and J6E database migrations/);
  assert.match(documentation, /J6B remains \*\*NO-GO\*\*/);
  assert.match(documentation, /J6C remains \*\*NO-GO\*\*/);
  assert.match(documentation, /5,000/);
});

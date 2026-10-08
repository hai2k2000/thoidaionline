import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildReopenRequest, projectVersionSnapshot, validateReopenReason } from "./personalWeeklyReportUi.mjs";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("weekly report route loads the authenticated employee view model", () => {
  const page = source("../app/reports/weekly/page.tsx") + source("../components/WeeklyReportLoadError.tsx");
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

test("weekly task hydration does not request a nonexistent Department Plan name column", () => {
  const repository = source("./personalWeeklyReportRepository.ts");
  assert.match(repository, /department_plan_items!department_plan_items_linked_task_id_fkey/);
  assert.doesNotMatch(repository, /department_plans\(name\)/);
});

test("weekly report page renders the three employee sections and empty state", () => {
  const component = source("../components/PersonalWeeklyReportPage.tsx");
  for (const heading of ["Kết quả công tác", "Kế hoạch công tác", "Kiến nghị\/Đề xuất"]) {
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
  assert.match(component, /Báo cáo các tuần trước/);
  assert.match(component, /proposal|đề xuất/i);
});

test("completed reports keep snapshot rows read-only while drafts retain editable commentary", () => {
  const component = source("../components/PersonalWeeklyReportPage.tsx");
  assert.match(component, /status\s*===\s*["']COMPLETED["']/);
  assert.match(component, /disabled=\{completed \|\| historical\}/);
  assert.match(component, /resultText|commentary/);
  assert.match(component, /historical/);
  assert.match(component, /Xem báo cáo/);
  assert.match(component, /report=/);
});

test("reloaded drafts preserve intentionally empty selections and commentary", () => {
  const component = source("../components/PersonalWeeklyReportPage.tsx");
  assert.match(component, /hasOwnProperty\.call\(savedDraft, ["']currentRows["']\)/);
  assert.match(component, /hasOwnProperty\.call\(savedDraft, ["']nextRows["']\)/);
  assert.match(component, /hasOwnProperty\.call\(savedDraft, ["']difficulties["']\)/);
  assert.doesNotMatch(component, /savedDraft\?\.nextRows\?\.length \?/);
  assert.doesNotMatch(component, /savedDraft\?\.currentRows\?\.length \?/);
});

test("weekly employee lookup disambiguates the Department relation", () => {
  const repository = source("./personalWeeklyReportRepository.ts");
  assert.match(repository, /departments!staff_users_department_id_fkey\(name\)/);
  assert.doesNotMatch(repository, /select\("id,full_name,department_id,departments\(name\)"\)/);
});

test("weekly report data failures render an error state instead of redirecting to Task Center", () => {
  const page = source("../app/reports/weekly/page.tsx") + source("../components/WeeklyReportLoadError.tsx");
  assert.doesNotMatch(page, /if \(!result\.ok\) redirect\("\/tasks"\)/);
  assert.match(page, /Không thể tải Báo cáo tuần\. Vui lòng thử lại\./);
});

test("completed own reports expose server-verified reopen action and exact modal copy", () => {
  const component = source("../components/PersonalWeeklyReportPage.tsx");
  assert.match(component, /reopenEligibility/);
  assert.match(component, /eligible\s*===\s*true/);
  assert.match(component, /Mở lại báo cáo/);
  assert.match(component, /Lịch sử phiên bản|hoàn thành vẫn được lưu trong lịch sử/);
  assert.match(component, /Lý do mở lại \*/);
  assert.match(component, /Huỷ/);
});

test("invalid reopen input cannot produce a network request body", () => {
  assert.equal(buildReopenRequest("report-7", " "), null);
  assert.equal(buildReopenRequest("report-7", "abcd"), null);
  assert.equal(buildReopenRequest("", "Valid reason"), null);
  assert.deepEqual(Object.keys(buildReopenRequest("report-7", "  Valid reason  ")), ["reportId", "reason"]);
});

test("reopened drafts are editable and show completion controls while completed history stays read-only", () => {
  const component = source("../components/PersonalWeeklyReportPage.tsx");
  assert.match(component, /Đang chỉnh sửa lại/);
  assert.match(component, /const reopened\s*=\s*!completed\s*&&\s*!historical/);
  assert.match(component, /disabled=\{completed \|\| historical\}/);
  assert.match(component, /Hoàn thành báo cáo/);
});

test("version history labels current and replaced versions without edit controls or internal IDs", () => {
  const component = source("../components/PersonalWeeklyReportPage.tsx");
  assert.match(component, /Lịch sử phiên bản/);
  assert.match(component, /Phiên bản hiện tại|Đang dùng/);
  assert.match(component, /Đã thay thế|Phiên bản cũ/);
  assert.match(component, /version_no/);
  assert.match(component, /completed_at/);
  assert.doesNotMatch(component, /version\.id.*textarea|version\.id.*button/);
});

test("reopened older-week drafts remain reachable from report history", () => {
  const component = source("../components/PersonalWeeklyReportPage.tsx");
  assert.match(component, /\/reports\/weekly\?periodStart=\$\{encodeURIComponent\(start\)\}/);
  assert.match(component, /Chỉnh sửa bản nháp/);
});

test("reopen reason validation and payload builder enforce the client boundary", () => {
  assert.equal(validateReopenReason("   ").ok, false);
  assert.equal(validateReopenReason("four").ok, false);
  assert.equal(validateReopenReason("  Sửa số liệu  ").value, "Sửa số liệu");
  assert.deepEqual(buildReopenRequest("report-7", "  Sửa số liệu  "), { reportId: "report-7", reason: "Sửa số liệu" });
  assert.equal(buildReopenRequest("report-7", "four"), null);
});

test("version snapshot projection exposes report content without internal IDs or edit affordances", () => {
  const projected = projectVersionSnapshot({ version_no: 1, snapshot_payload: { currentRows: [{ taskId: "task-1", title: "Viết bài", resultText: "Đã xong" }], nextRows: [{ taskId: "task-2", title: "Biên tập" }], difficulties: "Thiếu dữ liệu" } });
  assert.deepEqual(projected.currentRows, [{ title: "Viết bài", text: "Đã xong" }]);
  assert.deepEqual(projected.nextRows, [{ title: "Biên tập" }]);
  assert.equal(projected.difficulties, "Thiếu dữ liệu");
  assert.equal("taskId" in projected.currentRows[0], false);
});

test("reopen dialog keeps a stable focus target while the request is busy", () => {
  const component = source("../components/PersonalWeeklyReportPage.tsx");
  assert.match(component, /setAttribute\("tabindex", "-1"\)/);
  assert.match(component, /if \(!current\.length\) \{ event\.preventDefault\(\); dialog\.focus\(\); return; \}/);
});

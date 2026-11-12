import test from "node:test";
import assert from "node:assert/strict";
import { selectTasksForReport, currentReportWeek, taskListReportHref, parseReportRequest, reportFilterLabel } from "./taskListReport.mjs";
import { parseTaskListSearchParams } from "./taskFilters.mjs";
import JSZip from "jszip";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { contentDisposition } from "./contentDisposition.mjs";
import { isCollaboratorRole } from "./collaboratorRole.mjs";
import * as report from "./taskListReport.mjs";

test("selected report merges work sections, preserves status notes, excludes cancelled tasks, and recomputes counts", () => {
  assert.equal(typeof report.buildTaskListReportModel, "function");
  const model = report.buildTaskListReportModel({ tasks: [
    { id: "a", title: "Done", status: "done", task_assignees: [{ assignment_role: "owner", staff_users: { full_name: "An" } }] },
    { id: "b", title: "Late", status: "in_progress", due_date: "2020-01-01", task_assignees: [{ assignment_role: "owner", staff_users: { full_name: "Bình" } }] },
    { id: "c", title: "Open", status: "in_progress" },
    { id: "d", title: "Cancelled", status: "cancelled" },
  ], from: "2026-11-09", to: "2026-11-15", userName: "An", filterLabel: "Tất cả", now: new Date("2026-11-09T12:00:00Z") });
  const selected = report.selectTaskListReportModel(model, ["a", "b", "foreign", "a"]);
  assert.deepEqual(selected.counts, { total: 2 });
  assert.deepEqual(selected.sections.map(section => section.groups.flatMap(group => group.rows.map(row => row.id))), [["a", "b"]]);
  assert.equal(selected.sections[0].groups[1].name, "Bình");
  assert.match(selected.sections[0].groups[1].rows[0].statusNote, /Quá hạn$/);
  assert.equal(model.counts.total, 3);
  assert.deepEqual(model.sections.map(section => section.title), ["I. Công việc đã làm"]);
  assert.equal(model.sections[0].groups.flatMap(group => group.rows).some(row => row.id === "d"), false);
  assert.equal(report.selectTaskListReportModel(model, []).counts.total, 0);
});

test("merged rows keep input order within assignees, completion dates and overdue notes", () => {
  const model = report.buildTaskListReportModel({ tasks: [
    { id: "open", title: "Z", status: "in_progress", due_date: "2099-01-01", report_notes: "Đang viết" },
    { id: "done", title: "A", status: "done", due_date: "2020-01-01", completed_at: "2026-11-05T08:00:00Z" },
    { id: "late", title: "B", status: "in_progress", due_date: "2020-01-01", report_notes: "Chờ dữ liệu" },
    { id: "cancelled", title: "Không xuất", status: "cancelled", due_date: "2026-11-10" },
  ], from: "2026-11-09", to: "2026-11-15", userName: "An", filterLabel: "", now: new Date("2026-11-09T12:00:00Z") });
  assert.equal(model.sections.length, 1);
  assert.deepEqual(model.sections[0].groups[0].rows.map(row => [row.id, row.statusNote]), [
    ["open", "Đang thực hiện · Đang viết"],
    ["done", "Đã hoàn thành · 05/11/2026"],
    ["late", "Đang thực hiện · Chờ dữ liệu · Quá hạn"],
  ]);
  assert.equal(report.reportSummary(model.counts), "Tổng: 3 công việc");
  assert.equal(model.nextWeekPlan.title, "II. Kế hoạch tuần sau");
  assert.deepEqual(report.selectTaskListReportModel(model, ["late", "open"]).sections[0].groups[0].rows.map(row => row.id), ["open", "late"]);
});

test("report ids reject malformed or oversized selections and normalize UUID case", () => {
  assert.equal(typeof report.parseReportIds, "function");
  const id = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
  assert.deepEqual(report.parseReportIds(id + "," + id), [id.toLowerCase()]);
  assert.deepEqual(report.parseReportIds([]), []);
  assert.equal(report.parseReportIds(["foreign"]), null);
  assert.equal(report.parseReportIds(Array(1001).fill(id)), null);
});

test("selectTasksForReport includes activity in the inclusive range", () => {
  const rows = [
    { due_date: "2026-11-03", status: "in_progress", start_date: "2026-11-01" },
    { due_date: "2026-12-01", completed_at: "2026-11-04T08:00:00Z", status: "done" },
    { due_date: "2026-12-01", status: "in_progress", start_date: "2026-11-05" },
    { due_date: "2026-12-01", status: "done", completed_at: "2026-10-01T08:00:00Z" },
  ];
  assert.equal(selectTasksForReport(rows, "2026-11-03", "2026-11-05").length, 3);
});

test("report dates preserve all current list filters independently of pagination", () => {
  const query = parseTaskListSearchParams(new URLSearchParams("scope=mine&state=unfinished&q=abc&projectId=none&from=2026-01-01&to=2026-12-31&page=8&deadline=no_deadline"));
  const parsed = parseReportRequest(new URL(taskListReportHref(query, { from: "2026-11-02", to: "2026-11-08" }), "https://example.test").searchParams);
  assert.deepEqual(parsed.query, { ...query, page: 1, pageSize: 100 });
  assert.equal(parsed.from, "2026-11-02");
  assert.doesNotMatch(reportFilterLabel(query), /Phạm vi|Việc của tôi/);
  assert.match(reportFilterLabel(query), /Chưa hoàn thành/);
});

test("dates reject invalid calendar dates and default to the Vietnam Monday-Sunday week", () => {
  for (const range of ["from=2026-02-30&to=2026-03-01", "from=x&to=x", "from=2026-11-09&to=2026-11-08"]) assert.equal(parseReportRequest(new URLSearchParams(range)), null);
  assert.deepEqual(currentReportWeek(new Date("2026-11-08T18:00:00Z")), { from: "2026-11-09", to: "2026-11-15" });
  assert.deepEqual(currentReportWeek(new Date("2026-11-08T15:00:00Z")), { from: "2026-11-02", to: "2026-11-08" });
});

test("activity uses inclusive Vietnam dates and excludes future, undated and closed work without activity", () => {
  const rows = [
    { id: "boundary", status: "done", completed_at: "2026-11-08T17:00:00Z" },
    { id: "before", status: "done", completed_at: "2026-11-08T16:59:59Z" },
    { id: "open", status: "in_progress", start_date: "2020-01-01" },
    { id: "future", status: "new", start_date: "2026-11-16" },
    { id: "cancelled", status: "cancelled", start_date: "2020-01-01" },
    { id: "cancelled-due", status: "cancelled", due_date: "2026-11-10", completed_at: "2026-11-10T08:00:00Z" },
    { id: "undated", status: "new" },
  ];
  assert.deepEqual(selectTasksForReport(rows, "2026-11-09", "2026-11-15").map(row => row.id), ["boundary", "open"]);
});

test("DOCX contains Vietnamese sections, task rows, groups, signature and page fields", async () => {
  const { exportTaskListReportDocx } = await import("./taskListReportDocx.ts");
  const tasks = [{ id: "a", title: "Bài hoàn thành", status: "done", completed_at: "2026-11-09T08:00:00Z", task_assignees: [{ user_id: "an", assignment_role: "owner", staff_users: { full_name: "Nguyễn An" } }], project: { name: "Dự án A" } }, { id: "b", title: "Bài đang viết", status: "in_progress", task_assignees: [{ user_id: "binh", assignment_role: "owner", staff_users: { full_name: "Bình" } }] }, { id: "c", title: "Bài quá hạn", status: "in_progress", due_date: "2020-01-01" }];
  const buffer = await exportTaskListReportDocx({ tasks, from: "2026-11-09", to: "2026-11-15", userName: "Người lập thử", filterLabel: reportFilterLabel({ scope: "mine" }) });
  assert.ok(Buffer.isBuffer(buffer));
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml").async("string");
  for (const text of ["TẠP CHÍ THỜI ĐẠI", "Độc lập - Tự do - Hạnh phúc", "BÁO CÁO CÔNG VIỆC", "Từ ngày 09/11/2026 đến ngày 15/11/2026", "I. Công việc đã làm", "II. Kế hoạch tuần sau", "Người thực hiện", "NGƯỜI LẬP", "Người lập thử", "Bài hoàn thành", "Dự án A", "Bài đang viết", "Bài quá hạn", "Times New Roman"]) assert.ok(xml.includes(text), text);
  for (const heading of ["I. Đã hoàn thành", "II. Đang thực hiện", "III. Quá hạn", "V. Đã hủy"]) assert.ok(!xml.includes(heading), heading);
  assert.match(await zip.file("word/footer1.xml").async("string"), /PAGE/);
  assert.doesNotMatch(xml, /Phạm vi|Việc của tôi|Bộ lọc:/);
  assert.match(xml, /II\. Kế hoạch tuần sau/);
  assert.match(xml, /………/);
});

test("scope-only filter disappears while department, person and status remain", () => {
  assert.equal(reportFilterLabel({ scope: "mine" }), "");
  assert.equal(reportFilterLabel({ scope: "mine", departmentId: "d", personId: "p", status: "in_progress" }, [
    { department_id: "d", departments: { name: "Biên tập" }, task_assignees: [{ user_id: "p", staff_users: { full_name: "An" } }] },
  ]), "Phòng: Biên tập; Người làm: An; Trạng thái: Đang thực hiện");
});

test("next-week range is the following Monday-Sunday across week and year boundaries", () => {
  for (const [date, expected] of [
    ["2026-11-09", { from: "2026-11-16", to: "2026-11-22" }],
    ["2026-11-11", { from: "2026-11-16", to: "2026-11-22" }],
    ["2026-11-15", { from: "2026-11-16", to: "2026-11-22" }],
    ["2026-12-31", { from: "2027-01-04", to: "2027-01-10" }],
    ["2028-02-27", { from: "2028-02-28", to: "2028-03-05" }],
  ]) assert.deepEqual(report.nextWeekAfterReportDate(date), expected);
  assert.equal(report.nextWeekAfterReportDate("2026-02-30"), null);
  assert.deepEqual(report.nextWeekAfterReportDate(currentReportWeek(new Date("2026-11-08T17:00:00Z")).to), { from: "2026-11-16", to: "2026-11-22" });
});

test("plan accepts edited periods and old deadlines, ignores empty rows and strips unknown properties", () => {
  const result = report.validateNextWeekPlan({ from: "2026-11-20", to: "2026-11-30", html: "ignored", items: [
    { content: "  Nội dung <script>test</script>  ", assignee: " An ", dueDate: "2020-01-01", private: "ignored" },
    { content: "   ", assignee: "", dueDate: "" },
  ] }, "2026-11-15");
  assert.deepEqual(result, { ok: true, plan: { from: "2026-11-20", to: "2026-11-30", items: [{ content: "Nội dung <script>test</script>", assignee: "An", dueDate: "2020-01-01" }] } });
  assert.equal(report.validateNextWeekPlan({ from: "2026-11-16", to: "2026-11-22", items: [{ content: "", assignee: "An" }] }, "2026-11-15").ok, false);
});

test("quick-add uses selected active and overdue rows, deduplicates and enforces the row limit", () => {
  const model = report.buildTaskListReportModel({ tasks: [
    { id: "a", title: "Đang viết", status: "in_progress", due_date: "2099-01-01" },
    { id: "b", title: "Quá hạn", status: "in_progress", due_date: "2020-01-01", due_time: "15:00" },
    { id: "c", title: "Xong", status: "done" },
    { id: "d", title: "Bỏ chọn", status: "in_progress" },
  ], from: "2026-11-09", to: "2026-11-15", userName: "An", filterLabel: "" });
  const selected = report.selectTaskListReportModel(model, ["a", "b", "c"]);
  const items = report.appendNextWeekPlanTasks([], selected);
  assert.deepEqual(items.map(item => [item.content, item.dueDate]), [["Đang viết", "2099-01-01"], ["Quá hạn", "2020-01-01"]]);
  assert.deepEqual(report.appendNextWeekPlanTasks(items, selected), items);
  assert.equal(report.appendNextWeekPlanTasks(Array.from({ length: 99 }, (_, i) => ({ content: String(i), assignee: "", dueDate: "" })), selected).length, 100);
  assert.deepEqual(report.appendNextWeekPlanTasks([{ ...items[0], content: "  Đang viết  " }], selected).map(item => item.content), ["  Đang viết  ", "Quá hạn"]);
});

test("plan accepts boundary sizes and optional fields but rejects missing content in a nonempty row", () => {
  const period = { from: "2026-11-16", to: "2026-11-22" };
  const valid = report.validateNextWeekPlan({ ...period, items: Array.from({ length: 100 }, () => ({ content: "a".repeat(1000), assignee: "a".repeat(200) })) }, "2026-11-15");
  assert.equal(valid.ok, true);
  assert.equal(valid.plan.items.length, 100);
  assert.equal(valid.plan.items[0].dueDate, "");
  for (const item of [{ content: "", dueDate: "2026-11-20" }, { content: "a", assignee: null }, { content: "a", dueDate: null }, { content: "a\u0000" }]) assert.equal(report.validateNextWeekPlan({ ...period, items: [item] }, "2026-11-15").ok, false);
});

const routeSource = readFileSync(new URL("../app/api/tasks/report/docx/route.ts", import.meta.url), "utf8");
function route(overrides = {}) {
  const dependencies = { ...report, requireReadActor: async () => ({ ok: false, response: new Response(null, { status: 401 }) }), apiError: (_, status) => new Response(null, { status }), rpcFailure: () => new Response(null, { status: 503 }), isCollaboratorRole, parseReportRequest, taskRepository: { list: async () => { throw new Error("unexpected read"); } }, canUseJournalism: () => false, reportFilterLabel, selectTasksForReport, exportTaskListReportDocx: async () => new Uint8Array([80, 75]), taskListReportDocxFilename: (from, to) => "Bao_cao_cong_viec_" + from + "_" + to + ".docx", contentDisposition, ...overrides };
  const dataSource = readFileSync(new URL("./taskListReportData.ts", import.meta.url), "utf8").replace(/^import[\s\S]*?;\r?\n/gm, "").replace(/^export /gm, "");
  const dataJs = ts.transpileModule(dataSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  dependencies.getTaskListReportData = new Function(...Object.keys(dependencies), dataJs + "\nreturn getTaskListReportData;")(...Object.values(dependencies));
  const source = routeSource.replace(/^import .*;\r?\n/gm, "").replace(/export /g, "");
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return new Function(...Object.keys(dependencies), js + "\nreturn GET;")(...Object.values(dependencies));
}
const request = () => new Request("https://example.test/api/tasks/report/docx?from=2026-11-09&to=2026-11-15&scope=mine");
const user = { id: "user", full_name: "Nguyễn An", role_code: "employee", department_id: "dept", permissions: {}, rbacPermissions: [] };
test("route rejects unauthenticated and CTV requests before repository reads", async () => {
  assert.equal((await route()(request())).status, 401);
  assert.equal((await route({ requireReadActor: async () => ({ ok: true, actor: { ...user, role_code: "cong_tac_vien" } }) })(request())).status, 403);
});
test("route reads every scoped page, filters activity, and emits safe no-store DOCX headers", async () => {
  const calls = []; let model;
  const response = await route({ requireReadActor: async () => ({ ok: true, actor: user }), taskRepository: { list: async (actor, query) => { calls.push({ actor, query }); return { ok: true, data: { total: 101, items: query.page === 1 ? Array.from({ length: 100 }, (_, i) => ({ id: i, status: "in_progress", start_date: "2026-11-01" })) : [{ id: 101, status: "done", completed_at: "2026-10-01" }] } }; } }, exportTaskListReportDocx: async (input) => { model = input; return new Uint8Array([80, 75]); } })(request());
  assert.equal(response.status, 200); assert.equal(calls.length, 2);
  assert.equal(calls[0].actor.id, user.id); assert.equal(calls[0].query.scope, "mine");
  assert.equal(calls[1].query.page, 2); assert.equal(model.counts.total, 100); assert.equal(model.userName, user.full_name);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.match(response.headers.get("Content-Disposition"), /filename\*=UTF-8''Bao_cao_cong_viec_/);
  assert.ok([...response.headers.get("Content-Disposition")].every(char => char.charCodeAt(0) < 128));
});
test("route rejects oversized lists and invalid ranges without a partial export", async () => {
  const get = route({ requireReadActor: async () => ({ ok: true, actor: user }), taskRepository: { list: async () => ({ ok: true, data: { total: 1001, items: [] } }) } });
  assert.equal((await get(request())).status, 400);
  assert.equal((await get(new Request("https://example.test/api/tasks/report/docx?from=2026-02-30&to=2026-03-01"))).status, 400);
});

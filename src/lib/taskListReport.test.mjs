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

test("selected report recomputes counts and assignee groups without changing the full model", () => {
  assert.equal(typeof report.buildTaskListReportModel, "function");
  const model = report.buildTaskListReportModel({ tasks: [
    { id: "a", title: "Done", status: "done", task_assignees: [{ assignment_role: "owner", staff_users: { full_name: "An" } }] },
    { id: "b", title: "Late", status: "in_progress", due_date: "2020-01-01", task_assignees: [{ assignment_role: "owner", staff_users: { full_name: "Bình" } }] },
    { id: "c", title: "Open", status: "in_progress" },
  ], from: "2026-11-09", to: "2026-11-15", userName: "An", filterLabel: "Tất cả", now: new Date("2026-11-09T12:00:00Z") });
  const selected = report.selectTaskListReportModel(model, ["a", "b", "foreign", "a"]);
  assert.deepEqual(selected.counts, { total: 2, completed: 1, active: 1, overdue: 1, noDeadline: 1 });
  assert.deepEqual(selected.sections.map(section => section.groups.flatMap(group => group.rows.map(row => row.id))), [["a"], [], ["b"]]);
  assert.equal(selected.sections[2].groups[0].name, "Bình");
  assert.equal(model.counts.total, 3);
  assert.equal(report.selectTaskListReportModel(model, []).counts.total, 0);
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
  assert.match(reportFilterLabel(query), /Việc của tôi/);
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
    { id: "undated", status: "new" },
  ];
  assert.deepEqual(selectTasksForReport(rows, "2026-11-09", "2026-11-15").map(row => row.id), ["boundary", "open"]);
});

test("DOCX contains Vietnamese sections, task rows, groups, signature and page fields", async () => {
  const { exportTaskListReportDocx } = await import("./taskListReportDocx.ts");
  const tasks = [{ id: "a", title: "Bài hoàn thành", status: "done", completed_at: "2026-11-09T08:00:00Z", task_assignees: [{ user_id: "an", assignment_role: "owner", staff_users: { full_name: "Nguyễn An" } }], project: { name: "Dự án A" } }, { id: "b", title: "Bài đang viết", status: "in_progress", task_assignees: [{ user_id: "binh", assignment_role: "owner", staff_users: { full_name: "Bình" } }] }, { id: "c", title: "Bài quá hạn", status: "in_progress", due_date: "2020-01-01" }];
  const buffer = await exportTaskListReportDocx({ tasks, from: "2026-11-09", to: "2026-11-15", userName: "Người lập thử", filterLabel: "Phạm vi: Việc của tôi" });
  assert.ok(Buffer.isBuffer(buffer));
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml").async("string");
  for (const text of ["TẠP CHÍ THỜI ĐẠI", "Độc lập - Tự do - Hạnh phúc", "BÁO CÁO CÔNG VIỆC", "Từ ngày 09/11/2026 đến ngày 15/11/2026", "I. Đã hoàn thành", "II. Đang thực hiện", "III. Quá hạn", "Người thực hiện", "NGƯỜI LẬP", "Người lập thử", "Bài hoàn thành", "Dự án A", "Bài đang viết", "Bài quá hạn", "Times New Roman"]) assert.ok(xml.includes(text), text);
  assert.match(await zip.file("word/footer1.xml").async("string"), /PAGE/);
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

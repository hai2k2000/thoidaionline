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
    { id: "a", title: "Done", status: "done", task_assignees: [{ user_id: "actor", assignment_role: "owner", staff_users: { full_name: "An" } }] },
    { id: "b", title: "Late", status: "in_progress", due_date: "2020-01-01", task_assignees: [{ user_id: "actor", assignment_role: "owner", staff_users: { full_name: "BÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¬nh" } }] },
    { id: "c", title: "Open", status: "in_progress" },
    { id: "d", title: "Cancelled", status: "cancelled" },
  ], from: "2026-11-09", to: "2026-11-15", userName: "An", filterLabel: "TÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¥t cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â£", now: new Date("2026-11-09T12:00:00Z") });
  const selected = report.selectTaskListReportModel(model, ["a", "b", "foreign", "a"]);
  assert.deepEqual(selected.counts, { total: 2 });
  assert.deepEqual(selected.sections.map(section => section.rows.map(row => row.id)), [["b", "a"]]);
  assert.match(selected.sections[0].rows[1].statusNote, /^.+$/);
  assert.match(selected.sections[0].rows[0].statusNote, /Qu/);
  assert.equal(model.counts.total, 3);
  assert.equal(model.sections[0].title, "I. \u0043\u00f4ng vi\u1ec7c \u0111\u00e3 l\u00e0m");
  assert.equal(model.sections[0].rows.some(row => row.id === "d"), false);
  assert.equal(report.selectTaskListReportModel(model, []).counts.total, 0);
});

test("merged rows keep input order within assignees, completion dates and overdue notes", () => {
  const model = report.buildTaskListReportModel({ tasks: [
    { id: "open", title: "Z", status: "in_progress", due_date: "2099-01-01", report_notes: "ÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€šÃ‚Âang viÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¿t" },
    { id: "done", title: "A", status: "done", due_date: "2020-01-01", completed_at: "2026-11-05T08:00:00Z" },
    { id: "late", title: "B", status: "in_progress", due_date: "2020-01-01", report_notes: "ChÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â dÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â¯ liÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡u" },
    { id: "cancelled", title: "KhÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´ng xuÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¥t", status: "cancelled", due_date: "2026-11-10" },
  ], from: "2026-11-09", to: "2026-11-15", userName: "An", filterLabel: "", now: new Date("2026-11-09T12:00:00Z") });
  assert.equal(model.sections.length, 1);
  assert.deepEqual(model.sections[0].rows.map(row => row.id), ["done", "late", "open"]);
  assert.ok(model.sections[0].rows.every(row => typeof row.statusNote === "string"));
  assert.ok(model.nextWeekPlan.title.startsWith("II."));
  assert.deepEqual(report.selectTaskListReportModel(model, ["late", "open"]).sections[0].rows.map(row => row.id), ["late", "open"]);
});

test("done report-only tasks show report notes instead of completion dates", () => {
  const model = report.buildTaskListReportModel({ tasks: [{ id: "quick", title: "PhÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡t sinh", status: "done", workflow_type: "REPORT_ONLY", completed_at: "2026-11-10T08:00:00Z", report_notes: "ÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£ xÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â­ lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â½ xong" }], from: "2026-11-09", to: "2026-11-15", userName: "An", filterLabel: "" });
  assert.equal(model.sections[0].rows[0].statusNote, "ÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£ xÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â­ lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â½ xong");
});

test("normal assigned tasks append the latest progress report to the status note", () => {
  const model = report.buildTaskListReportModel({ tasks: [{
    id: "normal-progress",
    title: "Normal assigned task",
    status: "in_progress",
    task_type: "assigned",
    workflow_type: "STANDARD",
    task_assignees: [{ user_id: "actor", assignment_role: "owner" }],
    latest_progress_report: { report_status: "in_progress", progress_text: "Latest progress note", blockers: null },
  }], actorId: "actor", from: "2026-11-09", to: "2026-11-15", userName: "An", filterLabel: "" });
  assert.match(model.sections[0].rows[0].statusNote, /Latest progress note/);
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
  assert.doesNotMatch(reportFilterLabel(query), /PhÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡m vi|ViÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡c cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â§a tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´i/);
  assert.match(reportFilterLabel(query), /Ch\u01b0a ho\u00e0n th\u00e0nh/);
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

test("DOCX contains the flat work table, signature and page fields", async () => {
  const { exportTaskListReportDocx } = await import("./taskListReportDocx.ts");
  const tasks = [{ id: "a", title: "BÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â i hoÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â n thÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â nh", status: "done", completed_at: "2026-11-09T08:00:00Z", task_assignees: [{ user_id: "an", assignment_role: "owner", staff_users: { full_name: "NguyÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦n An" } }], project: { name: "DÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â± ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n A" } }, { id: "b", title: "BÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â i ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ang viÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¿t", status: "in_progress", task_assignees: [{ user_id: "binh", assignment_role: "owner", staff_users: { full_name: "BÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¬nh" } }] }, { id: "c", title: "BÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â i quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ hÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡n", status: "in_progress", due_date: "2020-01-01" }];
  const buffer = await exportTaskListReportDocx({ tasks, from: "2026-11-09", to: "2026-11-15", userName: "NgÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Âi lÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â­p thÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â­", filterLabel: reportFilterLabel({ scope: "mine" }) });
  assert.ok(Buffer.isBuffer(buffer));
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml").async("string");
  for (const text of ["T\u1ea0P CH\u00cd TH\u1edcI \u0110\u1ea0I", "B\u00c1O C\u00c1O C\u00d4NG VI\u1ec6C", "STT", "Times New Roman", "II. K\u1ebf ho\u1ea1ch tu\u1ea7n sau"]) assert.ok(xml.includes(text), text);
  for (const heading of ["I. ÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£ hoÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â n thÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â nh", "II. ÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€šÃ‚Âang thÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â±c hiÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡n", "III. QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ hÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡n", "V. ÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£ hÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â§y"]) assert.ok(!xml.includes(heading), heading);
  assert.match(await zip.file("word/footer1.xml").async("string"), /PAGE/);
  assert.doesNotMatch(xml, /PhÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡m vi|ViÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡c cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â§a tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´i|BÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ lÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Âc:/);
  assert.match(xml, /II\. K\u1ebf ho\u1ea1ch tu\u1ea7n sau/);
  assert.match(xml, /\u2026{3}/);
});

test("scope-only filter disappears while department, person and status remain", () => {
  assert.equal(reportFilterLabel({ scope: "mine" }), "");
  assert.ok(reportFilterLabel({ scope: "mine", departmentId: "d", personId: "p", status: "in_progress" }, [{ department_id: "d", departments: { name: "Bi?n t?p" }, task_assignees: [{ user_id: "p", staff_users: { full_name: "An" } }] }]).includes("An"));
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
    { content: "  NÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢i dung <script>test</script>  ", assignee: " An ", dueDate: "2020-01-01", private: "ignored" },
    { content: "   ", assignee: "", dueDate: "" },
  ] }, "2026-11-15");
  assert.deepEqual(result, { ok: true, plan: { from: "2026-11-20", to: "2026-11-30", items: [{ content: "NÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢i dung <script>test</script>", assignee: "An", dueDate: "2020-01-01" }] } });
  assert.equal(report.validateNextWeekPlan({ from: "2026-11-16", to: "2026-11-22", items: [{ content: "", assignee: "An" }] }, "2026-11-15").ok, false);
});

test("quick-add uses selected active and overdue rows, deduplicates and enforces the row limit", () => {
  const model = report.buildTaskListReportModel({ tasks: [
    { id: "a", title: "ÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€šÃ‚Âang viÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¿t", status: "in_progress", due_date: "2099-01-01" },
    { id: "b", title: "QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ hÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡n", status: "in_progress", due_date: "2020-01-01", due_time: "15:00" },
    { id: "c", title: "Xong", status: "done" },
    { id: "d", title: "BÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â chÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Ân", status: "in_progress" },
  ], from: "2026-11-09", to: "2026-11-15", userName: "An", filterLabel: "" });
  const selected = report.selectTaskListReportModel(model, ["a", "b", "c"]);
  const items = report.appendNextWeekPlanTasks([], selected);
  assert.deepEqual(items.map(item => [item.content, item.dueDate]), [["QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ hÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡n", "2020-01-01"], ["ÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€šÃ‚Âang viÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¿t", "2099-01-01"]]);
  assert.deepEqual(report.appendNextWeekPlanTasks(items, selected), items);
  assert.equal(report.appendNextWeekPlanTasks(Array.from({ length: 99 }, (_, i) => ({ content: String(i), assignee: "", dueDate: "" })), selected).length, 100);
  assert.equal(report.appendNextWeekPlanTasks([{ ...items[0], content: "  " + items[0].content.trim() + "  " }], selected).length, 2);
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
  const dependencies = { ...report, requireReadActor: async () => ({ ok: false, response: new Response(null, { status: 401 }) }), apiError: (_, status) => new Response(null, { status }), rpcFailure: () => new Response(null, { status: 503 }), isCollaboratorRole, parseReportRequest, taskRepository: { list: async () => { throw new Error("unexpected read"); } }, loadLatestTaskProgressReports: async ids => ({ ok: true, data: new Map(ids.map(id => [id, undefined])) }), canUseJournalism: () => false, reportFilterLabel, selectTasksForReport, exportTaskListReportDocx: async () => new Uint8Array([80, 75]), taskListReportDocxFilename: (from, to) => "Bao_cao_cong_viec_" + from + "_" + to + ".docx", contentDisposition, ...overrides };
  const dataSource = readFileSync(new URL("./taskListReportData.ts", import.meta.url), "utf8").replace(/^import[^\n]*\n/gm, "").replace(/^export /gm, "");
  const dataJs = ts.transpileModule(dataSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  dependencies.getTaskListReportData = new Function(...Object.keys(dependencies), dataJs + "\nreturn getTaskListReportData;")(...Object.values(dependencies));
  const source = routeSource.replace(/^import[^\n]*\n/gm, "").replace(/export /g, "");
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return new Function(...Object.keys(dependencies), js + "\nreturn GET;")(...Object.values(dependencies));
}
const request = () => new Request("https://example.test/api/tasks/report/docx?from=2026-11-09&to=2026-11-15&scope=mine");
const user = { id: "user", full_name: "NguyÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦n An", role_code: "employee", department_id: "dept", permissions: {}, rbacPermissions: [] };
test("route rejects unauthenticated and CTV requests before repository reads", async () => {
  assert.equal((await route()(request())).status, 401);
  assert.equal((await route({ requireReadActor: async () => ({ ok: true, actor: { ...user, role_code: "cong_tac_vien" } }) })(request())).status, 403);
});
test("route reads every scoped page, filters activity, and emits safe no-store DOCX headers", async () => {
  const calls = []; let model;
  const response = await route({ requireReadActor: async () => ({ ok: true, actor: user }), taskRepository: { list: async (actor, query) => { calls.push({ actor, query }); return { ok: true, data: { total: 101, items: query.page === 1 ? Array.from({ length: 100 }, (_, i) => ({ id: i, title: "Task " + i, status: "in_progress", start_date: "2026-11-01", task_assignees: [{ user_id: user.id, assignment_role: "owner" }] })) : [{ id: 101, title: "Task 101", status: "done", completed_at: "2026-10-01", task_assignees: [{ user_id: user.id, assignment_role: "owner" }] }] } }; } }, exportTaskListReportDocx: async (input) => { model = input; return new Uint8Array([80, 75]); } })(request());
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

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";
import JSZip from "jszip";
import * as report from "./taskListReport.mjs";
import { isCollaboratorRole } from "./collaboratorRole.mjs";
import { contentDisposition } from "./contentDisposition.mjs";
import { taskListHref } from "./taskFilters.mjs";

export function loadModule(path, dependencies, exports) {
  const file = new URL(path, import.meta.url);
  assert.ok(existsSync(file), `Missing implementation: ${path}`);
  const source = readFileSync(file, "utf8").replace(/^\uFEFF?import[\s\S]*?;\r?\n/gm, "").replace(/^export /gm, "");
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return new Function(...Object.keys(dependencies), js + `\nreturn { ${exports.join(",")} };`)(...Object.values(dependencies));
}

const visibleId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
const foreignId = "33333333-3333-4333-8333-333333333333";
const user = { id: "user", full_name: "NguyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¦n An", role_code: "employee", department_id: "dept", permissions: {}, rbacPermissions: [] };
const tasks = [
  { id: visibleId, title: "Visible task", status: "done", completed_at: "2026-11-09T09:00:00Z", task_assignees: [{ user_id: "user", assignment_role: "owner" }], storage_path: "private/storage", description: "private description" },
  { id: secondId, title: "Other visible task", status: "in_progress", start_date: "2026-11-01", due_date: "2099-01-01", task_assignees: [{ user_id: "user", assignment_role: "owner" }] },
];
const url = "https://example.test/api/tasks/report/docx?from=2026-11-09&to=2026-11-15&scope=mine";
const post = body => new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const payload = ids => ({ filters: { scope: "mine", fromDate: "2026-01-01", toDate: "2026-12-31" }, from: "2026-11-09", to: "2026-11-15", ids });

async function setup(options = {}) {
  const calls = [];
  const reportRows = {
    staff: options.staff ?? { job_titles: { name: "Biên tập viên" } },
    leaves: options.leaves ?? [],
  };
  const serverSupabase = { from(table) {
    const state = { table, filters: {} };
    const builder = {
      select: () => builder,
      eq: (key, value) => { state.filters[key] = value; return builder; },
      lte: (key, value) => { state.filters[key] = value; return builder; },
      gte: (key, value) => { state.filters[key] = value; return builder; },
      maybeSingle: async () => { assert.equal(state.filters.id, user.id); return { data: reportRows.staff, error: null }; },
      then: (resolve, reject) => {
        assert.deepEqual(state.filters, { requester_id: user.id, status: "approved", start_date: "2026-11-15", end_date: "2026-11-09" });
        return (options.leaveFailure ? Promise.reject(new Error("unavailable")) : Promise.resolve({ data: reportRows.leaves, error: options.leaveError ? {} : null })).then(resolve, reject);
      },
    };
    return builder;
  } };
  const dependencies = {
    ...report, taskListHref, isCollaboratorRole, contentDisposition,
    requireReadActor: async () => options.unauthenticated ? { ok: false, response: new Response(null, { status: 401 }) } : { ok: true, actor: { ...user, role_code: options.role ?? user.role_code } },
    apiError: (_, status) => new Response(null, { status }),
    rpcFailure: () => new Response(null, { status: 503 }),
    canUseJournalism: () => false,
    taskRepository: { list: async (actor, query) => {
      calls.push({ actor, query });
      assert.equal(actor.id, user.id);
      assert.equal(query.scope, "mine");
      assert.equal(query.pageSize, 100);
      return options.failure ? { ok: false, error: {} } : { ok: true, data: { total: options.total ?? tasks.length, items: options.items ?? tasks } };
    } },
    loadLatestTaskProgressReports: async ids => ({ ok: true, data: new Map(ids.map(id => [id, options.progress?.get(id)])) }),
    serverSupabase,
    ...await import("./taskListReportDocx.ts"),
  };
  Object.assign(dependencies, loadModule("./taskListReportData.ts", dependencies, ["getTaskListReportData"]));
  return {
    calls,
    ...loadModule("../app/api/tasks/report/docx/route.ts", dependencies, ["GET", "POST"]),
    preview: loadModule("../app/api/tasks/report/preview/route.ts", dependencies, ["GET"]).GET,
  };
}

test("preview and both DOCX methods enforce authentication and CTV exclusion before reading", async () => {
  for (const options of [{ unauthenticated: true }, { role: "cong_tac_vien" }]) {
    const routes = await setup(options);
    const expected = options.unauthenticated ? 401 : 403;
    assert.equal((await routes.preview(new Request(url))).status, expected);
    assert.equal((await routes.GET(new Request(url))).status, expected);
    assert.equal((await routes.POST(post(payload([visibleId])))).status, expected);
    assert.equal(routes.calls.length, 0);
  }
});

test("preview returns only actor-visible report fields, flat rows and counts", async () => {
  const routes = await setup();
  const response = await routes.preview(new Request(url));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const model = await response.json();
  const rows = model.sections.flatMap(section => section.rows);
  assert.deepEqual(rows.map(row => row.id), [secondId, visibleId]);
  assert.deepEqual(Object.keys(rows[0]).sort(), ["assignees", "assigner", "due", "id", "role", "statusNote", "title"]);
  assert.equal(model.counts.total, 2);
  assert.equal(model.userName, user.full_name);
  assert.ok(!JSON.stringify(model).includes("private"));
});

test("preview includes the job title and clipped approved leave from the server report path", async () => {
  const routes = await setup({ leaves: [
    { start_date: "2026-11-01", end_date: "2026-11-10", start_period: "full", end_period: "full", leave_type: "annual", status: "approved" },
    { start_date: "2026-11-12", end_date: "2026-11-12", start_period: "morning", end_period: "morning", leave_type: "sick", status: "pending" },
  ] });
  const model = await (await routes.preview(new Request(url))).json();
  assert.deepEqual(model.generalInfo.lines, [
    "Họ và tên: " + user.full_name,
    "Chức danh: Biên tập viên",
    "Thời gian thực hiện báo cáo: Từ ngày 9/11/2026 đến ngày 15/11/2026",
    "Thời gian đi công tác/tác nghiệp bên ngoài: Theo phân công (nếu có)",
    "Thời gian xin nghỉ phép: 9/11/2026 - 10/11/2026 (phép năm)",
  ]);
});

test("unavailable leave and missing job title retain the role and dotted fallback", async () => {
  for (const options of [{ leaves: [] }, { leaveFailure: true }, { leaveError: true }]) {
    const routes = await setup({ ...options, staff: { job_titles: null } });
    const model = await (await routes.preview(new Request(url))).json();
    assert.equal(model.jobTitle, "Nhân viên");
    assert.equal(model.generalInfo.lines[4], "Thời gian xin nghỉ phép: ………………………………………………");
  }
});

test("preview and DOCX load latest updates for normal and REPORT_ONLY tasks", async () => {
  const routes = await setup({
    items: [{ ...tasks[0], workflow_type: "REPORT_ONLY", report_notes: "Old quick note" }, tasks[1]],
    progress: new Map([
      [visibleId, { progress_text: "Latest quick update", blockers: null }],
      [secondId, { progress_text: "Latest normal update", blockers: null }],
    ]),
  });
  const model = await (await routes.preview(new Request(url))).json();
  assert.deepEqual(model.sections[0].rows.map(row => row.statusNote), [
    "Đang thực hiện · Latest normal update",
    "Đã hoàn thành 09/11/2026 · Latest quick update",
  ]);
  for (const response of [await routes.GET(new Request(url)), await routes.POST(post(payload([visibleId, secondId])))]) {
    assert.equal(response.status, 200);
    const xml = await (await JSZip.loadAsync(await response.arrayBuffer())).file("word/document.xml").async("string");
    for (const row of model.sections[0].rows) assert.ok(xml.includes(row.statusNote));
    assert.ok(!xml.includes("Old quick note"));
  }
});

test("POST and GET ids intersect the visible list; DOCX matches the selected preview", async () => {
  const routes = await setup();
  const response = await routes.POST(post(payload([visibleId, foreignId])));
  assert.equal(response.status, 200);
  assert.equal(routes.calls[0].query.fromDate, "2026-01-01");
  assert.equal(routes.calls[0].query.toDate, "2026-12-31");
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const xml = await zip.file("word/document.xml").async("string");
  assert.match(xml, /Visible task/);
  assert.ok(!xml.includes("Other visible task"));
  assert.match(xml, /Tổng: 1/);
  const preview = await (await routes.preview(new Request(url))).json();
  const selected = report.selectTaskListReportModel(preview, [visibleId, foreignId]);
  assert.ok(xml.includes(report.reportSummary(selected.counts)));
  const getResponse = await routes.GET(new Request(url + "&ids=" + secondId + "," + foreignId));
  const getXml = await (await JSZip.loadAsync(await getResponse.arrayBuffer())).file("word/document.xml").async("string");
  assert.match(getXml, /Other visible task/);
  assert.ok(!getXml.includes("Visible task"));
});

test("preview selection and DOCX both exclude cancelled tasks and counts", async () => {
  const routes = await setup({ items: [...tasks, { id: foreignId, title: "Cancelled report task", status: "cancelled", due_date: "2026-11-10" }] });
  const preview = await (await routes.preview(new Request(url))).json();
  assert.deepEqual(preview.counts, { total: 2 });
  assert.equal(preview.sections[0].title, "II. \u0043\u00f4ng vi\u1ec7c \u0111\u00e3 l\u00e0m");
  assert.ok(!JSON.stringify(preview).includes(foreignId));
  const response = await routes.POST(post(payload([visibleId, foreignId])));
  const xml = await (await JSZip.loadAsync(await response.arrayBuffer())).file("word/document.xml").async("string");
  assert.ok(xml.includes("Tổng: 1 công việc"));
  assert.doesNotMatch(xml, /Cancelled report task|V\. Ãƒâ€žÃ‚ÂÃƒÆ’Ã‚Â£ hÃƒÂ¡Ã‚Â»Ã‚Â§y/);
});

test("invalid dates, approval queues, malformed ids and bodies fail before repository reads", async () => {
  const routes = await setup();
  for (const body of [null, [], { ...payload([]), from: "2026-02-30" }, { ...payload([]), filters: { approvalQueue: "assignment" } }, payload(["invalid"]), payload(Array(1001).fill(visibleId)), { ...payload([]), filters: "mine" }]) {
    assert.equal((await routes.POST(post(body))).status, 400);
  }
  assert.equal((await routes.GET(new Request(url + "&ids=invalid"))).status, 400);
  assert.equal((await routes.preview(new Request(url + "&approvalQueue=assignment"))).status, 400);
  assert.equal(routes.calls.length, 0);
});

test("empty ids export zero tasks while omitted ids preserve the legacy full report", async () => {
  const routes = await setup();
  for (const [body, total] of [[payload([]), 0], [payload(undefined), 2], [payload([foreignId]), 0]]) {
    const response = await routes.POST(post(body));
    const xml = await (await JSZip.loadAsync(await response.arrayBuffer())).file("word/document.xml").async("string");
    assert.ok(xml.includes("T\u1ed5ng: " + total));
  }
});

test("preview cap and repository failures return errors without partial reports", async () => {
  assert.equal((await (await setup({ total: 1001 })).preview(new Request(url))).status, 400);
  assert.equal((await (await setup({ failure: true })).preview(new Request(url))).status, 503);
});

test("POST rejects nested filter values before URL serialization", async () => {
  const routes = await setup();
  const response = await routes.POST(post({ ...payload([visibleId]), filters: { scope: "mine", search: { toString: "invalid" } } }));
  assert.equal(response.status, 400);
  assert.equal(routes.calls.length, 0);
});

test("POST rejects invalid plan lengths, types and dates with Vietnamese 400 errors before reads", async () => {
  const routes = await setup();
  const valid = { from: "2026-11-16", to: "2026-11-22", items: [{ content: "ViÃƒÂ¡Ã‚ÂºÃ‚Â¿t bÃƒÆ’Ã‚Â i", assignee: "An", dueDate: "" }] };
  for (const nextWeekPlan of [
    null, [], { ...valid, items: Array(101).fill(valid.items[0]) },
    { ...valid, items: [{ content: "a".repeat(1001) }] },
    { ...valid, items: [{ content: "ViÃƒÂ¡Ã‚ÂºÃ‚Â¿t", assignee: "a".repeat(201) }] },
    { ...valid, items: [{ content: "ViÃƒÂ¡Ã‚ÂºÃ‚Â¿t", dueDate: "2026-02-30" }] },
    { ...valid, items: [{ content: { html: "ViÃƒÂ¡Ã‚ÂºÃ‚Â¿t" } }] },
    { ...valid, items: [{ content: "ViÃƒÂ¡Ã‚ÂºÃ‚Â¿t", assignee: 1 }] },
    { ...valid, items: [{ content: "ViÃƒÂ¡Ã‚ÂºÃ‚Â¿t", dueDate: {} }] },
    { ...valid, from: "2026-02-30" }, { ...valid, from: "2026-11-23" },
  ]) {
    const response = await routes.POST(post({ ...payload([visibleId]), nextWeekPlan }));
    assert.equal(response.status, 400);
    assert.match((await response.json()).error.message, /./);
  }
  assert.equal(routes.calls.length, 0);
});

test("POST DOCX renders edited plan after work, escapes text and ignores unknown client fields", async () => {
  const routes = await setup();
  const nextWeekPlan = { from: "2026-11-20", to: "2026-11-30", title: "UNTRUSTED", items: [
    { content: "ViÃƒÂ¡Ã‚ÂºÃ‚Â¿t <script> & bÃƒÆ’Ã‚Â i", assignee: "NguyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¦n An", dueDate: "2026-11-25", html: "UNTRUSTED" },
    { content: "", assignee: "", dueDate: "" },
  ] };
  const response = await routes.POST(post({ ...payload([visibleId]), nextWeekPlan }));
  assert.equal(response.status, 200);
  const xml = await (await JSZip.loadAsync(await response.arrayBuffer())).file("word/document.xml").async("string");
  for (const value of ["II. \u0043\u00f4ng vi\u1ec7c \u0111\u00e3 l\u00e0m", "III. K\u1ebf ho\u1ea1ch tu\u1ea7n sau", "25/11/2026"]) assert.ok(xml.includes(value), value);
  for (const heading of ["I. Ãƒâ€žÃ‚ÂÃƒÆ’Ã‚Â£ hoÃƒÆ’Ã‚Â n thÃƒÆ’Ã‚Â nh", "II. Ãƒâ€žÃ‚Âang thÃƒÂ¡Ã‚Â»Ã‚Â±c hiÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n", "III. QuÃƒÆ’Ã‚Â¡ hÃƒÂ¡Ã‚ÂºÃ‚Â¡n", "V. Ãƒâ€žÃ‚ÂÃƒÆ’Ã‚Â£ hÃƒÂ¡Ã‚Â»Ã‚Â§y"]) assert.ok(!xml.includes(heading), heading);
  assert.ok(xml.includes("II. Công việc đã làm"));
  assert.ok(xml.includes("III. Kế hoạch tuần sau"));
  assert.doesNotMatch(xml, /UNTRUSTED|<script>|PhÃƒÂ¡Ã‚ÂºÃ‚Â¡m vi|ViÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡c cÃƒÂ¡Ã‚Â»Ã‚Â§a tÃƒÆ’Ã‚Â´i/);
});

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
  const source = readFileSync(file, "utf8").replace(/^import[\s\S]*?;\r?\n/gm, "").replace(/^export /gm, "");
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return new Function(...Object.keys(dependencies), js + `\nreturn { ${exports.join(",")} };`)(...Object.values(dependencies));
}

const visibleId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
const foreignId = "33333333-3333-4333-8333-333333333333";
const user = { id: "user", full_name: "Nguyễn An", role_code: "employee", department_id: "dept", permissions: {}, rbacPermissions: [] };
const tasks = [
  { id: visibleId, title: "Visible task", status: "done", completed_at: "2026-11-09T09:00:00Z", storage_path: "private/storage", description: "private description" },
  { id: secondId, title: "Other visible task", status: "in_progress", start_date: "2026-11-01", due_date: "2099-01-01" },
];
const url = "https://example.test/api/tasks/report/docx?from=2026-11-09&to=2026-11-15&scope=mine";
const post = body => new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const payload = ids => ({ filters: { scope: "mine", fromDate: "2026-01-01", toDate: "2026-12-31" }, from: "2026-11-09", to: "2026-11-15", ids });

async function setup(options = {}) {
  const calls = [];
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

test("preview returns only actor-visible report fields, grouped rows and counts", async () => {
  const routes = await setup();
  const response = await routes.preview(new Request(url));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const model = await response.json();
  const rows = model.sections.flatMap(section => section.groups.flatMap(group => group.rows));
  assert.deepEqual(rows.map(row => row.id), [visibleId, secondId]);
  assert.deepEqual(Object.keys(rows[0]).sort(), ["assignees", "assigner", "due", "id", "statusNote", "title"]);
  assert.equal(model.counts.total, 2);
  assert.equal(model.userName, user.full_name);
  assert.ok(!JSON.stringify(model).includes("private"));
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
  assert.deepEqual(preview.sections.map(section => section.title), ["I. Công việc đã làm"]);
  assert.ok(!JSON.stringify(preview).includes(foreignId));
  const response = await routes.POST(post(payload([visibleId, foreignId])));
  const xml = await (await JSZip.loadAsync(await response.arrayBuffer())).file("word/document.xml").async("string");
  assert.match(xml, /Tổng: 1 công việc/);
  assert.doesNotMatch(xml, /Cancelled report task|V\. Đã hủy/);
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
    assert.ok(xml.includes("Tổng: " + total));
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
  const valid = { from: "2026-11-16", to: "2026-11-22", items: [{ content: "Viết bài", assignee: "An", dueDate: "" }] };
  for (const nextWeekPlan of [
    null, [], { ...valid, items: Array(101).fill(valid.items[0]) },
    { ...valid, items: [{ content: "a".repeat(1001) }] },
    { ...valid, items: [{ content: "Viết", assignee: "a".repeat(201) }] },
    { ...valid, items: [{ content: "Viết", dueDate: "2026-02-30" }] },
    { ...valid, items: [{ content: { html: "Viết" } }] },
    { ...valid, items: [{ content: "Viết", assignee: 1 }] },
    { ...valid, items: [{ content: "Viết", dueDate: {} }] },
    { ...valid, from: "2026-02-30" }, { ...valid, from: "2026-11-23" },
  ]) {
    const response = await routes.POST(post({ ...payload([visibleId]), nextWeekPlan }));
    assert.equal(response.status, 400);
    assert.match((await response.json()).error.message, /kế hoạch|Kế hoạch|công việc|Người thực hiện|Thời hạn/);
  }
  assert.equal(routes.calls.length, 0);
});

test("POST DOCX renders edited plan after work, escapes text and ignores unknown client fields", async () => {
  const routes = await setup();
  const nextWeekPlan = { from: "2026-11-20", to: "2026-11-30", title: "UNTRUSTED", items: [
    { content: "Viết <script> & bài", assignee: "Nguyễn An", dueDate: "2026-11-25", html: "UNTRUSTED" },
    { content: "", assignee: "", dueDate: "" },
  ] };
  const response = await routes.POST(post({ ...payload([visibleId]), nextWeekPlan }));
  assert.equal(response.status, 200);
  const xml = await (await JSZip.loadAsync(await response.arrayBuffer())).file("word/document.xml").async("string");
  for (const value of ["I. Công việc đã làm", "II. Kế hoạch tuần sau", "(Từ ngày 20/11/2026 đến ngày 30/11/2026)", "Nội dung công việc", "Người thực hiện", "Thời hạn", "Viết &lt;script&gt; &amp; bài", "25/11/2026"]) assert.ok(xml.includes(value), value);
  for (const heading of ["I. Đã hoàn thành", "II. Đang thực hiện", "III. Quá hạn", "V. Đã hủy"]) assert.ok(!xml.includes(heading), heading);
  assert.ok(xml.indexOf("I. Công việc đã làm") < xml.indexOf("II. Kế hoạch tuần sau"));
  assert.ok(xml.indexOf("II. Kế hoạch tuần sau") < xml.indexOf("NGƯỜI LẬP"));
  assert.doesNotMatch(xml, /UNTRUSTED|<script>|Phạm vi|Việc của tôi/);
});

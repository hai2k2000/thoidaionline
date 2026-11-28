import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as bulk from "./bulkApprove.mjs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const item = (id, extra = {}) => ({ id, record_code: `HS-${id}`, title: `Title ${id}`, status: "pending_review", updated_at: "1", ...extra });
const detail = (extra = {}) => ({ record: { record: { status: "pending_review", updated_at: "1", ...extra } } });

test("selection intersects visible pending rows with queue and allowed status filter", () => {
  const rows = [item("a"), item("b", { status: "draft" }), item("c")];
  assert.deepEqual(bulk.approvalSelection(rows, ["a", "b", "hidden"]), [item("a")]);
  for (const status of ["approved", "draft", "archived"]) assert.deepEqual(bulk.approvalSelection(rows, ["a"], status), []);
  assert.deepEqual(bulk.approvalSelection(rows, ["a"], "pending_review"), [item("a")]);
});

test("approves sequentially, reports progress and accepts real successful replay response", async () => {
  const calls = [];
  let inFlight = 0;
  const result = await bulk.runBulkApproval([item("a"), item("b")], {
    getRecord: async (id) => { assert.equal(inFlight, 0); calls.push(`get:${id}`); return detail(); },
    approve: async (id) => { inFlight++; assert.equal(inFlight, 1); await Promise.resolve(); calls.push(`approve:${id}`); inFlight--; return { ok: true, result: { replayed: id === "b" } }; },
    onProgress: (current, total) => calls.push(`${current}/${total}`),
  });
  assert.deepEqual(calls, ["1/2", "get:a", "approve:a", "2/2", "get:b", "approve:b"]);
  assert.deepEqual(result, { succeeded: [item("a"), item("b")], skipped: [], failed: [] });
  assert.deepEqual(bulk.summarizeApproval(result), { count: 2, issues: [] });
});

test("changed timestamps and nonpending records skip POST with distinct reasons", async () => {
  const result = await bulk.runBulkApproval([item("changed"), item("approved")], {
    getRecord: async (id) => detail(id === "changed" ? { updated_at: "2" } : { status: "approved" }),
    approve: async () => assert.fail("must not approve stale rows"),
  });
  assert.deepEqual(result.skipped, [
    { item: item("changed"), reason: "vừa được sửa, vui lòng xem lại" },
    { item: item("approved"), reason: "không còn ở trạng thái chờ duyệt" },
  ]);
  assert.deepEqual(bulk.summarizeApproval(result), { count: 0, issues: [
    { code: "HS-changed", reason: "vừa được sửa, vui lòng xem lại" },
    { code: "HS-approved", reason: "không còn ở trạng thái chờ duyệt" },
  ] });
});

test("GET failure, malformed detail and POST failure continue to later records", async () => {
  const posted = [];
  const result = await bulk.runBulkApproval([item("get"), item("malformed"), item("post"), item("ok")], {
    getRecord: async (id) => { if (id === "get") throw new Error("Không thể tải hồ sơ"); return id === "malformed" ? { error: "bad" } : detail(); },
    approve: async (id) => { posted.push(id); return id === "post" ? { ok: false, error: "Không có quyền" } : { ok: true }; },
  });
  assert.deepEqual(posted, ["post", "ok"]);
  assert.deepEqual(result.failed.map(({ item }) => item.id), ["get", "malformed", "post"]);
  assert.equal(result.skipped.length, 0);
  assert.deepEqual(result.succeeded, [item("ok")]);
});

test("a failed workflow is not mistaken for a replay", async () => {
  const result = await bulk.runBulkApproval([item("a")], { getRecord: async () => detail(), approve: async () => ({ ok: false, error: "already_approved" }) });
  assert.equal(result.failed.length, 1);
  assert.equal(result.succeeded.length, 0);
});

test("single flight rejects overlapping confirmation and run, then unlocks after cancellation or error", async () => {
  const run = bulk.createApprovalRunner();
  let release;
  let confirmations = 0;
  const first = run(async () => { confirmations++; return new Promise((resolve) => { release = resolve; }); });
  assert.equal(await run(async () => { confirmations++; }), null);
  assert.equal(confirmations, 1);
  release(false);
  assert.equal(await first, false);
  await assert.rejects(run(async () => { throw new Error("cancelled"); }), /cancelled/);
  assert.equal(await run(async () => "next"), "next");
});

test("page contract uses approval queue and confirmation", () => {
  const page = fs.readFileSync(new URL("../../app/database/records/page.tsx", import.meta.url), "utf8");
  assert.match(page, /approvalQueue=1/);
  assert.match(page, /requestConfirmation\(/);
});

const require = createRequire(import.meta.url);
const compile = (file) => ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const pageCode = compile("../../app/database/records/page.tsx");
const cardCode = compile("../../components/mobile/MobileCardList.tsx");
const link = ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children);
const cardExports = {};
new Function("require", "exports", cardCode)((name) => name === "next/link" ? { __esModule: true, default: link } : require(name), cardExports);
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const text = (node) => node == null || typeof node === "boolean" ? "" : Array.isArray(node) ? node.map(text).join("") : typeof node === "object" ? text(node.props?.children) : String(node);
const nodes = (node, predicate) => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
};

function pageHarness({ rows = [item("a"), item("b", { status: "draft" })], search = "", queue, detailResponse, workflow, confirm = async () => true } = {}) {
  let params = new URLSearchParams(search);
  const slots = [], effects = [], requests = [], confirmations = [], navigation = [];
  let stateCursor = 0, effectCursor = 0, dirty = true, tree;
  const auth = { loading: false, user: { id: "reviewer" }, logout() {}, hasPermission: () => true };
  const router = { push: (href) => navigation.push(href), replace: (href) => { params = new URL(href, "https://offline.invalid").searchParams; dirty = true; } };
  const hooks = {
    ...React,
    useState(initial) {
      const index = stateCursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (next) => { const value = typeof next === "function" ? next(slots[index]) : next; if (!Object.is(value, slots[index])) { slots[index] = value; dirty = true; } }];
    },
    useEffect(callback, deps) {
      const index = effectCursor++;
      const previous = effects[index];
      if (!previous || deps.some((dep, position) => !Object.is(dep, previous.deps[position]))) effects[index] = { deps, callback, cleanup: previous?.cleanup, pending: true };
    },
    useMemo: (callback) => callback(),
    useCallback: (callback) => callback,
  };
  const fetch = async (url, options = {}) => {
    const parsed = new URL(url, "https://offline.invalid");
    const request = { url: parsed, options };
    requests.push(request);
    if (parsed.pathname === "/api/database/catalog") return Response.json({ categories: [], recordTypes: [], forms: [] });
    if (parsed.pathname === "/api/database/records") {
      if (parsed.searchParams.get("approvalQueue") === "1") return queue ? queue(request) : Response.json({ records: rows.map(({ id }) => ({ id })) });
      return Response.json({ records: rows.map((row) => ({ ...row, total_count: 45 })), stats: { all: 45, pending_review: 20 } });
    }
    if (parsed.pathname.endsWith("/workflow")) return workflow ? workflow(request) : Response.json({ result: { replayed: true } });
    return detailResponse ? detailResponse(request) : Response.json(detail());
  };
  const deps = {
    react: hooks,
    "next/navigation": { useRouter: () => router, useSearchParams: () => params },
    "next/link": { __esModule: true, default: link },
    "@/lib/auth": { useAuth: () => auth },
    "@/components/ConfirmDialog": { useConfirm: () => async (options) => { confirmations.push(options); return confirm(options); } },
    "@/components/mobile/MobileCardList": cardExports,
  };
  const exports = {};
  new Function("require", "exports", "fetch", "setTimeout", "clearTimeout", pageCode)((name) => {
    if (deps[name]) return deps[name];
    if (name.startsWith("@/lib/")) return require(fileURLToPath(new URL(`../${name.slice("@/lib/".length)}`, import.meta.url)));
    if (name.startsWith("@/components/")) return { __esModule: true, default: () => null, EmptyState: () => null, ErrorState: () => null, LoadingState: () => null };
    return require(name);
  }, exports, fetch, () => 1, () => {});
  const Content = exports.default().props.children.type;
  return {
    requests, confirmations, navigation,
    get tree() { return tree; },
    find: (predicate) => nodes(tree, predicate),
    async flush() {
      for (let iteration = 0; iteration < 30; iteration++) {
        if (dirty) {
          dirty = false; stateCursor = 0; effectCursor = 0;
          tree = Content();
          for (const effect of effects) if (effect.pending) { effect.pending = false; effect.cleanup?.(); effect.cleanup = effect.callback(); }
        }
        await new Promise((resolve) => setImmediate(resolve));
        if (!dirty) return;
      }
      assert.fail("page failed to settle");
    },
    navigate(search) { params = new URLSearchParams(search); dirty = true; },
    close() { effects.forEach((effect) => effect.cleanup?.()); },
  };
}

test("mobile footer is outside link; desktop controls align and do not navigate by click or key", async () => {
  const app = pageHarness({ confirm: async () => false });
  await app.flush();
  const cards = app.find((node) => node.type === cardExports.MobileCard);
  const html = renderToStaticMarkup(cards[0]);
  assert.match(html, /<footer[^>]*>.*<input.*<button/);
  assert.ok(html.indexOf("</a>") < html.indexOf("<footer"));
  assert.ok(!renderToStaticMarkup(cards[1]).includes('type="checkbox"'));
  const headers = app.find((node) => node.type === "th");
  const rows = app.find((node) => node.type === "tr" && node.props.role === "link");
  assert.equal(headers.length, 6);
  assert.equal(text(headers[0]), "Duyệt");
  for (const row of rows) assert.equal(nodes(row, (node) => node.type === "td").length, headers.length);
  assert.equal(nodes(rows[1], (node) => node.type === "input" || node.type === "button").length, 0);
  const wrapper = nodes(rows[0], (node) => node.type === "div" && node.props.onKeyDown)[0];
  for (const type of ["input", "button"]) {
    const target = { closest: () => ({ tagName: type }) }, currentTarget = {};
    rows[0].props.onClick({ target });
    for (const key of ["Enter", " "]) {
      let stopped = false, prevented = false;
      const event = { target, currentTarget, key, stopPropagation: () => { stopped = true; }, preventDefault: () => { prevented = true; } };
      wrapper.props.onKeyDown(event);
      assert.equal(stopped, true);
      assert.equal(prevented, false);
      rows[0].props.onKeyDown(event);
    }
  }
  assert.deepEqual(app.navigation, []);
  const rowTarget = {};
  rows[0].props.onKeyDown({ target: rowTarget, currentTarget: rowTarget, key: "Enter", preventDefault() {} });
  assert.deepEqual(app.navigation, ["/database/records/a"]);
  app.close();
});

test("page confirms once, locks all controls, handles failed detail and reloads queue/list/stats", async () => {
  const confirmation = deferred(), loadingDetail = deferred();
  const app = pageHarness({ confirm: () => confirmation.promise, detailResponse: () => loadingDetail.promise });
  await app.flush();
  const button = app.find((node) => node.type === "button" && text(node) === "Duyệt")[0];
  button.props.onClick(); button.props.onClick();
  await app.flush();
  assert.equal(app.confirmations.length, 1);
  assert.match(app.confirmations[0].message, /HS-a – Title a.*không mở từng hồ sơ/);
  assert.deepEqual(Object.keys(app.confirmations[0]).sort(), ["confirmLabel", "message", "title"]);
  for (const control of app.find((node) => node.type === "button" && text(node).startsWith("Duyệt") || node.type === "input" && node.props.type === "checkbox")) assert.equal(control.props.disabled, true);
  confirmation.resolve(true);
  await app.flush();
  assert.match(text(app.tree), /Đang duyệt 1\/1/);
  const previousLists = app.requests.filter(({ url }) => url.pathname === "/api/database/records").length;
  loadingDetail.resolve(Response.json({ error: "record_read_failed" }, { status: 500 }));
  await app.flush();
  assert.match(text(app.tree), /Đã duyệt 0 hồ sơ.*HS-a: Không thể tải hồ sơ để kiểm tra/);
  assert.doesNotMatch(text(app.tree), /không còn ở trạng thái chờ duyệt/);
  assert.equal(app.requests.filter(({ options }) => options.method === "POST").length, 0);
  assert.ok(app.requests.filter(({ url }) => url.pathname === "/api/database/records").length > previousLists);
  assert.ok(app.requests.some(({ url }) => url.searchParams.get("includeStats") === "1"));
  app.close();
});

test("queue responses resolving after filter changes cannot restore approvable controls", async () => {
  const pending = [];
  const app = pageHarness({ search: "status=pending_review&q=old", queue: (request) => {
    const body = deferred(); pending.push({ request, body }); return { ok: true, json: () => body.promise };
  } });
  await app.flush();
  app.navigate("status=pending_review&q=new");
  await app.flush();
  const active = pending.findLast(({ request }) => !request.options.signal.aborted);
  active.body.resolve({ records: [] });
  await app.flush();
  for (const request of pending.filter((request) => request !== active)) request.body.resolve({ records: [{ id: "a" }] });
  await app.flush();
  assert.equal(app.find((node) => node.type === "button" && text(node) === "Duyệt").length, 0);
  assert.equal(app.find((node) => node.type === "tr" && node.props.role === "link").length, 2);
  for (const { request } of pending) {
    assert.equal(request.url.searchParams.has("status"), false);
    assert.equal(request.url.searchParams.get("limit"), "100");
    assert.equal(request.url.searchParams.get("offset"), "0");
  }
  app.close();
});

test("other statuses suppress approval even if listed data is pending, and queue errors keep list usable", async () => {
  for (const status of ["draft", "approved", "archived"]) {
    const app = pageHarness({ search: `status=${status}` });
    await app.flush();
    assert.equal(app.find((node) => node.type === "button" && text(node) === "Duyệt").length, 0);
    assert.equal(app.find((node) => node.type === "th").length, 5);
    app.close();
  }
  for (const queue of [async () => Response.json({}, { status: 500 }), async () => { throw new Error("offline"); }]) {
    const app = pageHarness({ queue });
    await app.flush();
    assert.equal(app.find((node) => node.type === "button" && text(node) === "Duyệt").length, 0);
    assert.equal(app.find((node) => node.type === "tr" && node.props.role === "link").length, 2);
    app.close();
  }
});

test("bulk confirmation caps names at ten, reports replay success and clears selection on page/filter changes", async () => {
  const rows = Array.from({ length: 12 }, (_, index) => item(String(index + 1)));
  const app = pageHarness({ rows });
  await app.flush();
  const selectAll = () => app.find((node) => node.type === "input" && node.props.type === "checkbox" && !node.props["aria-label"])[0];
  selectAll().props.onChange(); await app.flush();
  assert.match(text(app.tree), /Duyệt đã chọn \(12\)/);
  app.navigate("page=2"); await app.flush();
  assert.equal(selectAll().props.checked, false);
  selectAll().props.onChange(); await app.flush();
  app.navigate("q=filtered"); await app.flush();
  assert.equal(selectAll().props.checked, false);
  selectAll().props.onChange(); await app.flush();
  app.find((node) => node.type === "button" && text(node) === "Duyệt đã chọn (12)")[0].props.onClick();
  await app.flush();
  assert.equal(app.confirmations.length, 1);
  assert.match(app.confirmations[0].title, /12/);
  assert.match(app.confirmations[0].message, /HS-10 – Title 10 và 2 hồ sơ khác/);
  assert.doesNotMatch(app.confirmations[0].message, /HS-11|HS-12/);
  assert.equal(app.requests.filter(({ options }) => options.method === "POST").length, 12);
  for (const request of app.requests.filter(({ options }) => options.method === "POST")) assert.deepEqual(JSON.parse(request.options.body), { action: "approve" });
  assert.match(text(app.tree), /Đã duyệt 12 hồ sơ/);
  assert.equal(selectAll().props.checked, false);
  app.close();
});

test("workflow failures use HTTP status and error code mapping and do not stop the remaining batch", async () => {
  const app = pageHarness({ rows: [item("a"), item("b")], workflow: ({ url }) => url.pathname.includes("/a/") ? Response.json({ error: "self_approval_forbidden" }, { status: 403 }) : Response.json({ result: { replayed: true } }) });
  await app.flush();
  app.find((node) => node.type === "input" && node.props.type === "checkbox" && !node.props["aria-label"])[0].props.onChange(); await app.flush();
  app.find((node) => node.type === "button" && text(node) === "Duyệt đã chọn (2)")[0].props.onClick(); await app.flush();
  assert.match(text(app.tree), /Đã duyệt 1 hồ sơ.*HS-a: Không thể tự phê duyệt hồ sơ của mình/);
  app.close();
});

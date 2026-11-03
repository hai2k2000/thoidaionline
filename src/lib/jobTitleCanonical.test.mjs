import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { isEligibleAssignmentReviewer, isLeadershipAssignmentReviewer } from "./taskReviewerPolicy.mjs";

const source = fs.readFileSync(new URL("../app/api/job-titles/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function loadRoute() {
  let row = { id: "ctv-id", code: "ctv", name: "Cộng tác viên", display_order: 100, active: false };
  const writes = [];
  const query = {
    select: () => query,
    eq: () => query,
    insert: (value) => { writes.push(value); row = { ...row, ...value }; return query; },
    update: (value) => { writes.push(value); row = { ...row, ...value }; return query; },
    single: async () => ({ data: row, error: null }),
    maybeSingle: async () => ({ data: row, error: null }),
  };
  const dependencies = {
    "next/server": { NextResponse: Response },
    "@/lib/serverSession": { getSessionUser: async () => ({ id: "admin-id", role_code: "admin" }), isSameOriginRequest: async () => true },
    "@/lib/serverSupabase": { serverSupabase: { from: (table) => { assert.equal(table, "job_titles"); return query; } } },
    "@/lib/services/audit": { logAudit: async () => {} },
  };
  const exports = {};
  new Function("require", "exports", compiled)((name) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, exports);
  return { ...exports, writes };
}

const request = (body) => new Request("http://localhost/api/job-titles", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

for (const method of ["POST", "PATCH"]) {
  test(`${method} allows an active ctv job title`, async () => {
    const route = loadRoute();
    const response = await route[method](request({ id: "ctv-id", code: "ctv", name: "Cộng tác viên", active: true }));
    assert.equal(response.status, method === "POST" ? 201 : 200);
    assert.equal((await response.json()).job_title.active, true);
    assert.equal(route.writes.length, 1);
    assert.equal(route.writes[0].code, "ctv");
    assert.equal(route.writes[0].active, true);
  });
}

test("unknown active titles remain rejected with the allowed codes", async () => {
  const route = loadRoute();
  const response = await route.POST(request({ code: "unknown_title", name: "Unknown title", active: true }));
  assert.equal(response.status, 400);
  const { error } = await response.json();
  assert.match(error, /\bctv\b/);
  assert.doesNotMatch(error, /7 chức danh/);
  assert.equal(route.writes.length, 0);
});

test("ctv is editable as a canonical title in the job-title UI", () => {
  const page = fs.readFileSync(new URL("../app/job-titles/page.tsx", import.meta.url), "utf8");
  const codes = page.match(/const canonicalCodes = new Set\((\[[^\]]+\])\)/);
  assert.ok(codes);
  assert.ok(JSON.parse(codes[1]).includes("ctv"));
});

test("ctv alone grants no leadership or assignment reviewer eligibility", () => {
  assert.equal(isLeadershipAssignmentReviewer("ctv"), false);
  assert.equal(isEligibleAssignmentReviewer({ roleCode: "nhan_vien", jobTitleCode: "ctv", isDepartmentManager: false }), false);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
import testing from "next/experimental/testing/server.js";
import * as policy from "./collaboratorRole.mjs";

const compiled = ts.transpileModule(readFileSync("src/proxy.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function load(roleCode) {
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { roles: { code: roleCode } }, error: null }) };
  const deps = {
    "next/server": { NextRequest, NextResponse },
    "@/lib/collaboratorRole.mjs": policy,
    "@/lib/serverSupabase": { serverSupabase: { from: () => query } },
    "@/lib/sessionToken": { verifySignedSessionToken: () => ({ userId: "user", sessionVersion: 1 }) },
    "@/lib/firstLoginPassword": { getFirstLoginGateDecision: () => ({ type: "allow" }) },
  };
  const result = {};
  new Function("require", "exports", compiled)((name) => { assert.ok(deps[name], name); return deps[name]; }, result);
  return result;
}
test("proxy returns 403 or redirects for CTV and preserves employee access", async () => {
  const previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "test-only-session-secret-with-32-characters";
  try {
    const { proxy, config } = load("cong_tac_vien");
    for (const path of ["/api/attendance", "/api/database/records", "/api/tasks/assign", "/api/tasks/quick-report", "/api/attendance/export.xlsx"]) {
      assert.equal(testing.unstable_doesMiddlewareMatch({ config, url: path }), true, path);
      assert.equal((await proxy(new NextRequest(`http://localhost${path}`))).status, 403, path);
    }
    for (const path of ["/users", "/users/abc", "/profile", "/evaluation-summary", "/tasks/assign"]) {
      assert.equal((await proxy(new NextRequest(`http://localhost${path}`))).headers.get("location"), "http://localhost/my-tasks", path);
    }
    assert.equal((await proxy(new NextRequest("http://localhost/my-tasks"))).status, 200);
    assert.equal((await load("nhan_vien").proxy(new NextRequest("http://localhost/api/attendance"))).status, 200);
  } finally {
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
  }
});

test("public PWA assets bypass live actor lookup and private mobile routes remain scoped", async () => {
  const previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "test-only-session-secret-with-32-characters";
  try {
    const { proxy } = load("cong_tac_vien");
    for (const path of ["/manifest.webmanifest", "/sw.js", "/offline.html", "/icons/icon-192.png", "/mobile-app", "/api/mobile/apk/latest", "/api/mobile/apk/download"]) {
      const response = await proxy(new NextRequest(`http://localhost${path}`));
      assert.equal(response.status, 200, path);
      assert.match(response.headers.get("Content-Security-Policy"), /worker-src 'self'/);
    }
    for (const path of ["/api/mobile/apk/latest", "/api/mobile/apk/download"]) {
      assert.equal((await proxy(new NextRequest(`http://localhost${path}`, { method: "POST" }))).status, 403);
    }
    for (const path of ["/mobile-app/admin", "/api/mobile/apk/other", "/icons-private"]) assert.notEqual((await proxy(new NextRequest(`http://localhost${path}`))).status, 200);
  } finally { if (previous === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = previous; }
});

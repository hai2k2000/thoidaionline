import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
import * as tokens from "./sessionToken.ts";
import * as policy from "./collaboratorRole.mjs";

function load(path, deps) {
  const compiled = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const result = {};
  new Function("require", "exports", compiled)((name) => {
    assert.ok(Object.hasOwn(deps, name), name);
    return deps[name];
  }, result);
  return result;
}
const session = load("src/lib/serverSession.ts", {
  "server-only": {}, "node:crypto": {}, "next/headers": {},
  "./collaboratorRole.mjs": policy, "@/lib/serverSupabase": {},
  "@/lib/sessionToken": tokens, "@/lib/permissions": {},
  "@/lib/accountPreferences": {}, "@/lib/rbac/repository": {},
});
const cookie = session.SESSION_COOKIE;

test("cookie helper matches both TTLs and preserves security attributes", () => {
  for (const remember of [true, false]) {
    const options = session.sessionCookieOptionsFor(remember);
    assert.equal(options.maxAge, remember ? 2592000 : 28800);
    assert.equal(options.httpOnly, true);
    assert.equal(options.secure, process.env.NODE_ENV === "production");
    assert.equal(options.sameSite, "strict");
    assert.equal(options.path, "/");
  }
  assert.equal(session.sessionCookieOptionsFor(true, true).maxAge, 28800);
});

test("login accepts only boolean true and preserves the password-change argument", async () => {
  const route = load("src/app/api/auth/login/route.ts", {
    "next/server": { NextResponse },
    "@/lib/serverSession": { ...session, isSameOriginRequest: async () => true },
    "@/lib/authenticateCredentials": { authenticateCredentials: async () => ({ userId: "u", sessionVersion: 3 }), AuthenticationUnavailableError: class extends Error {} },
    "@/lib/loginRateLimit": { consumeLoginAttempt: () => ({ allowed: true }), clearLoginAttempts: () => {} },
  });
  const previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "remember-login-local-test-secret-32-characters";
  try {
    for (const remember of [true, false, undefined, "true", 1, null]) {
      const response = await route.POST(new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify({ identifier: "u", password: "p", remember }) }));
      assert.equal(response.status, 200);
      const result = response.cookies.get(cookie);
      assert.equal(result.maxAge, remember === true ? 2592000 : 28800);
      const payload = tokens.verifySignedSessionToken({ token: result.value, secret: process.env.SESSION_SECRET });
      assert.equal(payload.remember, remember === true);
      assert.equal(payload.mustChangePassword, false);
      assert.equal(payload.sessionVersion, 3);
    }
  } finally {
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
  }
});

test("proxy slides valid remembered cookies on page/API requests and rejects renewal for invalid sessions", async () => {
  const previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "remember-login-local-test-secret-32-characters";
  const now = Math.floor(Date.now() / 1000);
  let row = { roles: { code: "nhan_vien" }, active: true, session_version: 3, must_change_password: false };
  let error = null;
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: row, error }) };
  const { proxy } = load("src/proxy.ts", {
    "next/server": { NextRequest, NextResponse },
    "@/lib/serverSession": session, "@/lib/sessionToken": tokens,
    "@/lib/collaboratorRole.mjs": policy,
    "@/lib/serverSupabase": { serverSupabase: { from: () => query } },
    "@/lib/firstLoginPassword": { getFirstLoginGateDecision: () => ({ type: "allow" }) },
  });
  const makeToken = (overrides = {}) => tokens.createSignedSessionToken({ userId: "u", sessionVersion: 3, remember: true, nowSeconds: now - 86400, secret: process.env.SESSION_SECRET, ...overrides });
  const request = (path, token = makeToken(), bearer = false) => proxy(new NextRequest(`http://localhost${path}`, { headers: bearer ? { authorization: `Bearer ${token}` } : { cookie: `${cookie}=${token}` } }));
  try {
    for (const path of ["/tasks", "/api/tasks", "/api/auth/session"]) {
      const response = await request(path);
      const result = response.cookies.get(cookie);
      assert.equal(result.maxAge, 2592000);
      assert.match(response.headers.get("Cache-Control"), /no-store/);
      const payload = tokens.verifySignedSessionToken({ token: result.value, secret: process.env.SESSION_SECRET });
      assert.ok(payload.issuedAt >= now);
      assert.equal(payload.expiresAt - payload.issuedAt, 2592000);
      assert.equal(payload.sessionVersion, 3);
    }
    for (const path of ["/api/auth/logout", "/api/account/password", "/api/auth/login", "/api/auth/mobile-login"]) {
      assert.equal((await request(path)).cookies.get(cookie), undefined, path);
    }
    for (const token of [makeToken({ nowSeconds: now - 100 }), makeToken({ remember: false, nowSeconds: now - 100 }), makeToken({ mustChangePassword: true }), makeToken({ nowSeconds: now - 2592000 }), "invalid", tokens.signSessionPayload({ userId: "u", sessionVersion: 3, expiresAt: now + 100 }, process.env.SESSION_SECRET)]) {
      assert.equal((await request("/api/tasks", token)).cookies.get(cookie), undefined);
    }
    assert.equal((await request("/api/tasks", makeToken(), true)).cookies.get(cookie), undefined);
    for (const change of [{ active: false }, { session_version: 4 }, { must_change_password: true }, { roles: null }]) {
      const original = row;
      row = { ...row, ...change };
      assert.equal((await request("/tasks")).cookies.get(cookie), undefined);
      row = original;
    }
    error = { message: "unavailable" };
    assert.equal((await request("/tasks")).status, 503);
  } finally {
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
  }
});

test("session reads cannot overwrite remembered cookies; logout and password revocation remain intact", () => {
  // The session route may only refresh non-remembered (8h) tokens.
  assert.match(readFileSync("src/app/api/auth/session/route.ts", "utf8"), /if \(session && !session\.remember\) response\.cookies\.set\(SESSION_COOKIE, createSessionToken\(user\.id, user\.session_version, false\), sessionCookieOptions\)/);
  const logout = readFileSync("src/app/api/auth/logout/route.ts", "utf8");
  assert.match(logout, /maxAge: 0/);
  assert.match(logout, /session_version: user\.session_version \+ 1/);
  assert.match(logout, /eq\("session_version", user\.session_version\)/);
  assert.match(readFileSync("src/app/api/account/password/route.ts", "utf8"), /session_version: data.session_version \+ 1/);
});


test("logout revokes an in-flight remembered renewal without changing ordinary logout", async () => {
  const previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "remember-login-local-test-secret-32-characters";
  const now = Math.floor(Date.now() / 1000);
  let version = 3;
  let remember = true;
  const old = tokens.createSignedSessionToken({ userId: "u", sessionVersion: version, remember, nowSeconds: now - 86400, secret: process.env.SESSION_SECRET });
  const query = { update: (change) => { version = change.session_version; return query; }, eq: () => query, then: (resolve) => resolve({ error: null }) };
  const route = load("src/app/api/auth/logout/route.ts", {
    "next/server": { NextResponse },
    "next/headers": { cookies: async () => ({ get: () => ({ value: old }) }) },
    "@/lib/serverSession": { ...session, verifySessionToken: () => ({ remember }), isSameOriginRequest: async () => true, getSessionUser: async () => ({ id: "u", session_version: version }) },
    "@/lib/serverSupabase": { serverSupabase: { from: () => query } },
  });
  try {
    const inFlight = tokens.verifySignedSessionToken({ token: old, secret: process.env.SESSION_SECRET });
    const response = await route.POST();
    assert.equal(response.cookies.get(cookie).maxAge, 0);
    assert.equal(version, 4);
    // A response signed after logout still carries the version it authenticated with.
    const late = tokens.createSignedSessionToken({ userId: inFlight.userId, sessionVersion: inFlight.sessionVersion, remember: true, secret: process.env.SESSION_SECRET });
    assert.notEqual(tokens.verifySignedSessionToken({ token: late, secret: process.env.SESSION_SECRET }).sessionVersion, version);
    remember = false;
    await route.POST();
    assert.equal(version, 4);
  } finally {
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
  }
});

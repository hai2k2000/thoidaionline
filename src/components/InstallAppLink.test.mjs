import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolvePostLoginPath } from "../lib/firstLoginPassword.ts";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import jsxRuntime from "react/jsx-runtime";
import { shouldShowInstallApp } from "../lib/installApp.mjs";

test("each authenticated role renders the install link in browser mode, never in PWA or APK mode", () => {
  const source = readFileSync(new URL("./InstallAppLink.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  let user = null;
  let pathname = "/tasks";
  let installed = false;
  const deps = {
    "react": { ...React, useSyncExternalStore: () => !installed },
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
    "next/navigation": { usePathname: () => pathname },
    "@/lib/auth": { useAuth: () => ({ user }) },
    "@/lib/installApp.mjs": { shouldShowInstallApp },
  };
  const result = {};
  new Function("require", "exports", compiled)((name) => { assert.ok(deps[name], name); return deps[name]; }, result);
  const render = () => renderToStaticMarkup(React.createElement(result.default, { mobile: true }));
  assert.equal(render(), "");
  for (const role_code of ["admin", "tong_bien_tap", "pho_tong_bien_tap", "phu_trach_phong_tri_su", "phu_trach_phong_phong_vien", "phu_trach_phong_bien_tap", "tri_su", "nhan_vien", "cong_tac_vien"]) {
    user = { role_code };
    assert.match(render(), /href="\/app"[^>]*>[\s\S]*Cài app/);
    installed = true;
    assert.equal(render(), "");
    installed = false;
    pathname = "/app";
    assert.equal(render(), "");
    pathname = "/tasks";
  }
});

test("install link is suppressed in installed contexts and on the install page", async () => {
  const path = new URL("../lib/installApp.mjs", import.meta.url);
  assert.ok(existsSync(path), "install visibility helper exists");
  const { shouldShowInstallApp } = await import(path);
  assert.equal(shouldShowInstallApp({ pathname: "/tasks" }), true);
  for (const context of [{ standalone: true }, { iosStandalone: true }, { userAgent: "Mozilla ThoidaiWorkApp/1.0.3+5" }, { pathname: "/app" }, { pathname: "/app/" }]) {
    assert.equal(shouldShowInstallApp({ pathname: "/tasks", ...context }), false);
  }
});

test("shell includes compact install links outside role restrictions", () => {
  const source = readFileSync(new URL("./AppNav.tsx", import.meta.url), "utf8");
  assert.match(source, /<InstallAppLink/);
  assert.match(source, /mobile-app-bar[\s\S]*<InstallAppLink/);
  const component = new URL("./InstallAppLink.tsx", import.meta.url);
  assert.ok(existsSync(component));
  const link = readFileSync(component, "utf8");
  assert.match(link, /href="\/app"/);
  assert.match(link, /display-mode: standalone/);
  assert.match(link, /navigator/);
  assert.doesNotMatch(link, /isCollaboratorRole|beforeinstallprompt/);
});

test("login preserves only the supported install destination", () => {
  assert.equal(resolvePostLoginPath(false, "/app"), "/app");
  assert.equal(resolvePostLoginPath(false, "/mobile-app"), "/app");
  for (const next of [null, "https://evil.test", "//evil.test", "/app/other"]) assert.equal(resolvePostLoginPath(false, next), "/");
  const login = readFileSync(new URL("../app/login/page.tsx", import.meta.url), "utf8");
  assert.match(login, /href="\/login\?next=\/app"/);
  assert.match(login, /Cài ứng dụng/);
});

test("canonical install page requires login and legacy route permanently redirects", () => {
  const path = new URL("../app/app/page.tsx", import.meta.url);
  assert.ok(existsSync(path));
  assert.match(readFileSync(path, "utf8"), /if \(!user\) redirect\("\/login\?next=\/app"\)/);
  assert.match(readFileSync(new URL("../app/mobile-app/page.tsx", import.meta.url), "utf8"), /permanentRedirect\("\/app"\)/);
});

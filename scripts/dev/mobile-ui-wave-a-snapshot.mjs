import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as taskFilters from "../../src/lib/taskFilters.mjs";
import * as journalismUi from "../../src/lib/journalismUi.mjs";
import { JOURNALISM_UI_HIDDEN } from "../../src/lib/journalismUiHidden.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "../..");
const read = (path) => readFileSync(join(root, path), "utf8");
const require = createRequire(import.meta.url);
const compilerOptions = { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true };
const modules = new Map();
const user = { id: "snapshot-user", full_name: "Nguyễn An", role_code: "admin" };

// Render real source without hydration, authentication, or network calls.
function load(path) {
  const absolute = resolve(root, path);
  if (modules.has(absolute)) return modules.get(absolute);
  const componentModule = { exports: {} };
  modules.set(absolute, componentModule.exports);
  const localRequire = (id) => {
    if (id === "@/lib/auth") return { useAuth: () => ({ user, login: () => {}, logout: () => {} }) };
    if (id === "next/navigation") return { useRouter: () => ({}), usePathname: () => "/tasks" };
    if (id === "next/image") return { __esModule: true, default: ({ src, alt, width, height, className }) => React.createElement("img", { src: `data:image/png;base64,${readFileSync(join(root, "public", src)).toString("base64")}`, alt, width, height, className }) };
    if (!id.startsWith("@/") && !id.startsWith(".")) return require(id);
    const target = id.startsWith("@/") ? join(root, "src", id.slice(2)) : resolve(dirname(absolute), id);
    const resolved = [target, `${target}.tsx`, `${target}.ts`, `${target}.mjs`].find(existsSync);
    assert.ok(resolved, `Cannot resolve ${id} from ${path}`);
    return resolved.endsWith(".mjs") ? require(resolved) : load(resolved);
  };
  const js = ts.transpileModule(readFileSync(absolute, "utf8"), { compilerOptions }).outputText;
  new Function("require", "module", "exports", js)(localRequire, componentModule, componentModule.exports);
  return componentModule.exports;
}

function compileComponent(source, name, bindings) {
  const js = ts.transpileModule(source, { compilerOptions: { ...compilerOptions, jsx: ts.JsxEmit.React } }).outputText;
  return new Function("React", ...Object.keys(bindings), `${js};return ${name};`)(React, ...Object.values(bindings));
}

const Link = require("next/link").default;
const nav = read("src/components/AppNav.tsx");
const MobileIcon = compileComponent(nav.slice(nav.indexOf("function MobileIcon(")), "MobileIcon", {});
const appBar = nav.slice(nav.indexOf('<div className="mobile-app-bar'), nav.indexOf('{user && !["/login"'));
const bottomNav = nav.slice(nav.indexOf('<nav aria-label="Điều hướng di động"'), nav.indexOf("</nav> : null}") + "</nav>".length);
const MobileNavigation = compileComponent(`function MobileNavigation() { return <aside data-app-navigation>${appBar}${bottomNav}</aside>; }`, "MobileNavigation", {
  Link, MobileIcon,
  InstallAppLink: load("src/components/InstallAppLink.tsx").default,
  NotificationBell: load("src/components/NotificationBell.tsx").default,
  isCollaboratorRole: () => false,
  user, userLabel: user.full_name, mobileTitle: "Quản lý công việc",
  labels: { tasks: "Quản lý công việc" }, currentPath: "/tasks",
  navigation: { primary: [{ id: "tasks", href: "/tasks" }], configuration: [], account: [] },
  isNavigationActive: () => true,
  mobileNavigation: { items: [
    { id: "tasks", href: "/tasks", kind: "tasks", label: "Công việc" },
    { id: "schedule", href: "/work-schedule", kind: "calendar", label: "Lịch" },
    { id: "attendance", href: "/attendance", kind: "attendance", label: "Chấm công" },
    { id: "more", href: "more", kind: "more", label: "Thêm" },
  ] },
  mobileActive: (href) => href === "/tasks", mobileOpen: false, mobileObscured: false,
  activeItem: true, menuButtonRef: null, setMobileOpen: () => {},
});

const taskSource = read("src/components/TaskCenterShell.tsx");
const FilterFields = compileComponent(taskSource.slice(taskSource.indexOf("function FilterFields("), taskSource.indexOf("function SummaryItem(")), "FilterFields", {
  Link, useState: React.useState,
  TaskFilterPopover: load("src/components/TaskFilterPopover.tsx").default,
  PersonFilter: load("src/components/PersonFilter.tsx").default,
  taskListHref: taskFilters.taskListHref, JOURNALISM_UI_HIDDEN,
  journalismLabels: journalismUi.journalismLabels,
  journalismPublicationStatusLabel: journalismUi.journalismPublicationStatusLabel,
});
const filterClass = taskSource.match(/<form id="task-filter-form"[^>]*className="([^"]+)"/)[1];
const filter = React.createElement("form", { id: "task-filter-form", className: filterClass }, React.createElement(FilterFields, {
  query: taskFilters.parseTaskListSearchParams(new URLSearchParams()), departments: [], personOptions: [], canFilterByPerson: true,
  journalismWorkKinds: [], journalismTopics: [], journalismSeries: [], canAccessJournalism: false, canReviewTaskApprovals: false,
}));

// Include all emitted CSS chunks; rebase assets for an HTML file opened directly from disk.
const cssDirectory = join(root, ".next/static/css");
const chunkDirectory = join(root, ".next/static/chunks");
const cssFiles = [cssDirectory, chunkDirectory].flatMap((path) => existsSync(path)
  ? readdirSync(path).filter((file) => file.endsWith(".css")).map((file) => join(path, file)) : []);
assert.ok(cssFiles.length, "Run npm run build first: no built CSS found.");
const css = cssFiles.sort().map((file) => readFileSync(file, "utf8").replace(/url\((['"]?)([^)'"\s]+)\1\)/g, (whole, quote, url) => {
  if (/^(?:data:|https?:|#)/.test(url)) return whole;
  const asset = url.startsWith("/_next/") ? join(root, ".next", url.slice(7)) : resolve(dirname(file), url);
  assert.ok(existsSync(asset), `Missing built CSS asset: ${asset}`);
  const mime = asset.endsWith(".woff2") ? "font/woff2" : asset.endsWith(".woff") ? "font/woff" : "application/octet-stream";
  return `url("data:${mime};base64,${readFileSync(asset).toString("base64")}")`;
})).join("\n");
writeFileSync(join(directory, "mobile-ui-wave-a.css"), css);
const fontVariables = [...css.matchAll(/\.([\w-]+)\{--font-(?:vietnam-sans|geist-mono):/g)].map((match) => match[1]).join(" ");

const render = (component, props = {}) => renderToStaticMarkup(React.createElement(component, props));
const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Thời Đại Work - Mobile UI wave A</title><link rel="stylesheet" href="./mobile-ui-wave-a.css">
<style>
/* Only the review canvas is styled here; component layout comes from built CSS. */
.snapshot-content{max-width:1240px;margin:24px auto;padding:0 16px 80px}
.snapshot-content>section{margin-block:24px}
</style></head><body class="${fontVariables}">
<!-- Real login page + AuthShell + PasswordInput; no network or form submissions. -->
${render(load("src/app/login/page.tsx").default)}
<main class="snapshot-content">
${render(MobileNavigation)}
<section aria-label="Bộ lọc công việc">${renderToStaticMarkup(filter)}</section>
<section aria-label="Nút chính và phụ">${render(load("src/components/PrintActions.tsx").default, { documentTitle: "Công việc", docxHref: "#" })}</section>
<section aria-label="Liên kết trong đoạn văn"><p>Đọc <a href="#" class="text-brand-ink underline">hướng dẫn sử dụng</a> để tìm hiểu cách theo dõi công việc và hạn hoàn thành. Liên kết này phải nằm gọn trong dòng văn bản.</p></section>
<section aria-label="Trạng thái công việc" class="flex flex-wrap gap-2">
<span class="table-status bg-success-soft text-success">Hoàn thành</span>
<span class="table-status bg-warning-soft text-warning">Sắp đến hạn</span>
<span class="table-status bg-danger-soft text-danger">Quá hạn</span>
<span class="table-status bg-info-soft text-info">Đang xử lý</span>
</section></main></body></html>`;
writeFileSync(join(directory, "mobile-ui-wave-a-snapshot.html"), html);
console.log(`Snapshot written: scripts/dev/mobile-ui-wave-a-snapshot.html (${cssFiles.length} built CSS chunks)`);

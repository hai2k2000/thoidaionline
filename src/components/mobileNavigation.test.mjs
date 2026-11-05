import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getMobileNavigation, isMobileNavigationActive } from "./mobileNavigation.ts";
import { getPhase2Navigation } from "./phase2Navigation.ts";
import * as mobileNavigation from "./mobileNavigation.ts";

const access = {
  roleCode: "nhan_vien", canAssignTask: false, canEvaluateStep1: false,
  canEvaluateStep2: false, canManageRubrics: false, canManageUsers: false,
  canManagePermissions: false,
};

test("standalone authenticated task edit and print pages retain mobile navigation", () => {
  for (const page of ["admin-edit", "print"]) {
    const source = readFileSync(new URL(`../app/tasks/[id]/${page}/page.tsx`, import.meta.url), "utf8");
    assert.match(source, /getSessionUser/);
    assert.match(source, /className="lg:hidden print:hidden"><AppNav currentPath=/);
  }
});

test("focus alone, browser chrome and pinch zoom do not hide mobile navigation", () => {
  const open = mobileNavigation.isMobileKeyboardOpen;
  assert.equal(typeof open, "function");
  assert.equal(open({ baselineHeight: 800, viewportHeight: 800, scale: 1, editableFocused: true }), false);
  assert.equal(open({ baselineHeight: 800, viewportHeight: 730, scale: 1, editableFocused: true }), false);
  assert.equal(open({ baselineHeight: 800, viewportHeight: 400, scale: 2, editableFocused: true }), false);
  assert.equal(open({ baselineHeight: 800, viewportHeight: 480, scale: 1, editableFocused: false }), false);
  assert.equal(open({ baselineHeight: 800, viewportHeight: 480, scale: 1, editableFocused: true }), true);
  assert.equal(open({ baselineHeight: 800, viewportHeight: 800, scale: 1, editableFocused: true }), false);
});

test("only a rendered modal or sheet suppresses the navigation", () => {
  const visible = mobileNavigation.isVisibleMobileOverlay;
  assert.equal(typeof visible, "function");
  const overlay = (changes = {}) => ({
    closest: () => null,
    getClientRects: () => [{ width: 360, height: 400 }],
    parentElement: null,
    ...changes,
  });
  const style = () => ({ display: "block", visibility: "visible", opacity: "1" });
  assert.equal(visible(overlay(), style), true);
  assert.equal(visible(overlay({ getClientRects: () => [] }), style), false);
  assert.equal(visible(overlay({ closest: () => ({ hidden: true }) }), style), false);
  assert.equal(visible(overlay(), () => ({ ...style(), visibility: "hidden" })), false);
  assert.equal(visible(overlay(), () => ({ ...style(), opacity: "0" })), false);
  const hiddenParent = {};
  assert.equal(visible(overlay({ parentElement: hiddenParent }), node => node === hiddenParent ? { ...style(), display: "none" } : style()), false);
});

test("mobile navigation keeps the five most useful links for an administrator", () => {
  const nav = getPhase2Navigation({ ...access, roleCode: "admin" });
  assert.deepEqual(getMobileNavigation(nav, "admin").items.map((item) => item.href), [
    "/", "/my-tasks", "/projects", "/my-attendance", "more",
  ]);
  assert.ok(getMobileNavigation(nav, "admin").menu.configuration.length > 0);
});

test("mobile navigation filters inaccessible projects for normal staff", () => {
  const result = getMobileNavigation(getPhase2Navigation(access), "nhan_vien");
  assert.deepEqual(result.items.map((item) => item.href), ["/", "/my-tasks", "/my-attendance", "more"]);
  for (const grant of [{ hasProjectMembership: true }, { canCreateProject: true }]) {
    assert.ok(getMobileNavigation(getPhase2Navigation({ ...access, ...grant }), "nhan_vien").items.some((item) => item.href === "/projects"));
  }
});

test("mobile active state follows route prefixes and the personal-task redirect", () => {
  for (const [path, active] of [["/tasks", "/"], ["/tasks?type=personal", "/my-tasks"], ["/tasks/task-1", "/my-tasks"], ["/projects/project-1", "/projects"], ["/my-attendance", "/my-attendance"]]) {
    const selected = ["/", "/my-tasks", "/projects", "/my-attendance"].filter((href) => isMobileNavigationActive(path, href));
    assert.deepEqual(selected, [active]);
  }
});

test("collaborators get tasks, projects and a restricted More menu", () => {
  const result = getMobileNavigation(getPhase2Navigation({ ...access, roleCode: "cong_tac_vien", hasProjectMembership: true }), "cong_tac_vien");
  assert.deepEqual(result.items.map((item) => item.href), ["/my-tasks", "/projects", "more"]);
  assert.equal(result.menu.primary.length, 0);
  assert.deepEqual(result.menu.account.map((item) => item.href), ["/account"]);
  assert.deepEqual(result.menu.configuration, []);
  assert.deepEqual(result.menu.journalism, []);
});

test("collaborator project.create alone does not bypass membership", () => {
  const result = getMobileNavigation(getPhase2Navigation({ ...access, roleCode: "cong_tac_vien", canCreateProject: true }), "cong_tac_vien");
  assert.deepEqual(result.items.map((item) => item.href), ["/my-tasks", "more"]);
});

test("More menu exposes Help for roles that render HelpBot", () => {
  for (const roleCode of ["admin", "nhan_vien", "tong_bien_tap", "pho_tong_bien_tap", "cong_tac_vien"]) {
    assert.equal(getMobileNavigation(getPhase2Navigation({ ...access, roleCode }), roleCode).showHelp, roleCode !== "cong_tac_vien");
  }
  const source = readFileSync(new URL("./AppNav.tsx", import.meta.url), "utf8");
  assert.match(source, /Trợ giúp/);
  assert.match(source, /thoidai:open-help/);
  assert.match(source, /lg:hidden/);
});

test("install entry points use the canonical /app route", () => {
  const source = readFileSync(new URL("./AppNav.tsx", import.meta.url), "utf8");
  assert.match(source, /href=\"\/app\"/);
  assert.doesNotMatch(source, /href=\"\/mobile-app\"/);
});

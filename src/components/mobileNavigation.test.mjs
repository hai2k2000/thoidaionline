import assert from "node:assert/strict";
import test from "node:test";
import { getMobileNavigation, isMobileNavigationActive } from "./mobileNavigation.ts";
import { getPhase2Navigation } from "./phase2Navigation.ts";

const access = {
  roleCode: "nhan_vien", canAssignTask: false, canEvaluateStep1: false,
  canEvaluateStep2: false, canManageRubrics: false, canManageUsers: false,
  canManagePermissions: false,
};

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

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLegacyTaskRedirect,
  getPhase2Navigation,
  LEGACY_TASK_REDIRECTS,
} from "./phase2Navigation.ts";

const employee = {
  roleCode: "nhan_vien",
  departmentCode: null,
  canAccessJournalism: false,
  canAssignTask: false,
  canEvaluateStep1: false,
  canEvaluateStep2: false,
  canManageRubrics: false,
  canManageUsers: false,
  canManagePermissions: false,
};

test("employee navigation exposes only Task Center and account", () => {
  const navigation = getPhase2Navigation(employee);

  assert.deepEqual(navigation.primary, [
    { id: "tasks", href: "/tasks" },
  ]);
  assert.deepEqual(navigation.account, [
    { id: "account", href: "/account" },
  ]);
  assert.equal(navigation.showEvaluationTab, false);
  assert.deepEqual(navigation.configuration, []);
});

test("journalism navigation is limited to Content scope or editorial leadership", () => {
  const content = getPhase2Navigation({
    ...employee,
    departmentCode: "editorial",
    canAccessJournalism: true,
    canManageJournalismStructures: true,
  });
  const unrelatedManager = getPhase2Navigation({
    ...employee,
    roleCode: "truong_phong",
    departmentCode: "business",
    canAccessJournalism: true,
    canManageJournalismStructures: true,
  });
  const editorialLead = getPhase2Navigation({
    ...employee,
    roleCode: "pho_tong_bien_tap",
    canAccessJournalism: true,
  });

  assert.deepEqual(content.primary.find((item) => item.id === "journalism-reports"), { id: "journalism-reports", href: "/journalism/reports" });
  assert.deepEqual(content.configuration.find((item) => item.id === "journalism-structures"), { id: "journalism-structures", href: "/journalism/structures" });
  assert.equal(unrelatedManager.primary.some((item) => item.id === "journalism-reports"), false);
  assert.equal(unrelatedManager.configuration.some((item) => item.id === "journalism-structures"), false);
  assert.deepEqual(editorialLead.primary.find((item) => item.id === "journalism-reports"), { id: "journalism-reports", href: "/journalism/reports" });
});

test("manager and TBT see assignment while read-only TBT does not", () => {
  const manager = getPhase2Navigation({
    ...employee,
    roleCode: "truong_phong",
    canAssignTask: true,
    canEvaluateStep1: true,
    isDepartmentManager: true,
  });
  const tbt = getPhase2Navigation({
    ...employee,
    roleCode: "tong_bien_tap",
    canEvaluateStep2: true,
  });

  assert.deepEqual(manager.primary, [
    { id: "assign", href: "/tasks/assign" },
    { id: "tasks", href: "/tasks" },
    { id: "evaluations", href: "/evaluations" },
  ]);
  assert.equal(manager.showEvaluationTab, true);
  assert.deepEqual(tbt.primary, [
    { id: "tasks", href: "/tasks" },
    { id: "evaluations", href: "/evaluations" },
  ]);
  assert.equal(tbt.showEvaluationTab, true);
});

test("shared-rubric configuration remains admin-only", () => {
  assert.deepEqual(
    getPhase2Navigation({
      ...employee,
      roleCode: "admin",
      canManageRubrics: true,
    }).configuration,
    [{ id: "evaluation-rubrics", href: "/configuration/evaluation-rubrics" }],
  );
  assert.deepEqual(
    getPhase2Navigation({
      ...employee,
      canManageRubrics: true,
    }).configuration,
    [],
  );
});

test("admin configuration restores legacy administration beside new configuration", () => {
  assert.deepEqual(
    getPhase2Navigation({
      ...employee,
      roleCode: "admin",
      canManageUsers: true,
      canManagePermissions: true,
      canManageRubrics: true,
    }).configuration,
    [
      { id: "users", href: "/users" },
      { id: "departments", href: "/departments" },
      { id: "permissions", href: "/permissions" },
      {
        id: "evaluation-rubrics",
        href: "/configuration/evaluation-rubrics",
      },
    ],
  );
});

test("legacy administration visibility is fail-closed by admin role and permission", () => {
  const usersOnly = getPhase2Navigation({
    ...employee,
    roleCode: "admin",
    canManageUsers: true,
  });
  const permissionsOnly = getPhase2Navigation({
    ...employee,
    roleCode: "admin",
    canManagePermissions: true,
  });
  const nonAdmin = getPhase2Navigation({
    ...employee,
    canManageUsers: true,
    canManagePermissions: true,
  });

  assert.deepEqual(usersOnly.configuration, [
    { id: "users", href: "/users" },
    { id: "departments", href: "/departments" },
  ]);
  assert.deepEqual(permissionsOnly.configuration, [
    { id: "permissions", href: "/permissions" },
  ]);
  assert.deepEqual(nonAdmin.configuration, []);
});

test("legacy redirects preserve unrelated query state and lock canonical filters", () => {
  assert.equal(buildLegacyTaskRedirect("/", "q=bao&page=2"), "/tasks?q=bao&page=2");
  assert.equal(buildLegacyTaskRedirect("/tasks/active", "department=abc&status=done"), "/tasks?department=abc&status=active");
  assert.equal(buildLegacyTaskRedirect("/tasks/pending-review", ""), "/tasks?status=pending_review");
  assert.equal(buildLegacyTaskRedirect("/tasks/done", "q=x"), "/tasks?q=x&status=done");
  assert.equal(buildLegacyTaskRedirect("/my-tasks", "page=3"), "/tasks?page=3&type=personal");
  assert.equal(buildLegacyTaskRedirect("/planning", ""), "/tasks?type=personal");
  assert.equal(buildLegacyTaskRedirect("/planning/reports", "type=assigned"), "/tasks?type=personal&scope=managed");
  assert.equal(buildLegacyTaskRedirect("/performance", "q=x"), "/tasks?q=x&view=evaluations");
});

test("every compatibility route has a deterministic target", () => {
  assert.deepEqual(Object.keys(LEGACY_TASK_REDIRECTS).sort(), [
    "/", "/my-tasks", "/performance", "/planning", "/planning/reports",
    "/tasks/active", "/tasks/done", "/tasks/pending-review",
  ]);
});

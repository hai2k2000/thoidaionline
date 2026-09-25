import assert from "node:assert/strict";
import test from "node:test";
import { buildLegacyTaskRedirect, getPhase2Navigation, isNavigationActive, LEGACY_TASK_REDIRECTS } from "./phase2Navigation.ts";
const employee = { roleCode: "nhan_vien", departmentCode: null, canAccessJournalism: false, canAssignTask: false, canEvaluateStep1: false, canEvaluateStep2: false, canManageRubrics: false, canManageUsers: false, canManagePermissions: false };
const journalismItems = [
  { id: "journalism-tasks", href: "/tasks?journalism=only" },
  { id: "journalism-calendar", href: "/journalism/calendar" },
  { id: "journalism-reports", href: "/journalism/reports" },
];
for (const [roleCode, departmentCode, visible] of [
  ["nhan_vien", "editorial", true], ["tong_bien_tap", "leadership", true],
  ["pho_tong_bien_tap", "leadership", true], ["nhan_vien", "general", false],
  ["truong_phong", "communications", false], ["admin", "business", false],
]) test("Journalism sidebar scope: " + roleCode + "/" + departmentCode, () => {
  const navigation = getPhase2Navigation({ ...employee, roleCode, departmentCode, canAccessJournalism: true, canManageJournalismStructures: true });
  assert.deepEqual(navigation.journalism, visible ? [...journalismItems, { id: "journalism-structures", href: "/journalism/structures" }] : []);
  assert.equal([...navigation.primary, ...navigation.configuration].some(item => item.id.startsWith("journalism-")), false);
  const all = [...navigation.primary, ...navigation.journalism, ...navigation.configuration, ...navigation.account];
  assert.equal(new Set(all.map(item => item.href)).size, all.length);
});
test("existing Journalism permissions still gate section and structures", () => {
  assert.deepEqual(getPhase2Navigation({ ...employee, departmentCode: "editorial" }).journalism, []);
  assert.deepEqual(getPhase2Navigation({ ...employee, departmentCode: "editorial", canAccessJournalism: true }).journalism, journalismItems);
});
test("work and schedule navigation is preserved", () => {
  const navigation = getPhase2Navigation({ ...employee, canAssignTask: true });
  assert.deepEqual(navigation.primary.slice(0, 2), [{ id: "assign", href: "/tasks/assign" }, { id: "tasks", href: "/tasks" }]);
  for (const id of ["attendance", "work-schedule", "work-schedule-staff", "duty-schedule", "online-work"]) assert.ok(navigation.primary.some(item => item.id === id));
  assert.deepEqual(navigation.account, [{ id: "account", href: "/account" }]);
  assert.deepEqual(navigation.configuration, []);
});
test("manager and editorial leadership retain assignment and evaluation navigation", () => {
  for (const roleCode of ["truong_phong", "tong_bien_tap", "pho_tong_bien_tap"]) {
    const navigation = getPhase2Navigation({ ...employee, roleCode, canAssignTask: roleCode === "truong_phong", canEvaluateStep1: true, canEvaluateStep2: true, isDepartmentManager: true });
    assert.ok(navigation.primary.some(item => item.id === "assign"));
    assert.equal(navigation.showEvaluationTab, true);
  }
});
test("administration still requires admin role and individual permission", () => {
  const admin = getPhase2Navigation({ ...employee, roleCode: "admin", canManageUsers: true, canManagePermissions: true, canManageRubrics: true });
  for (const id of ["users", "departments", "permissions", "evaluation-rubrics", "evaluation-cycles"]) assert.ok(admin.configuration.some(item => item.id === id));
  const restricted = getPhase2Navigation({ ...employee, roleCode: "admin" });
  assert.equal(restricted.configuration.some(item => ["users", "departments", "permissions", "evaluation-rubrics"].includes(item.id)), false);
  assert.deepEqual(getPhase2Navigation({ ...employee, canManageUsers: true, canManagePermissions: true, canManageRubrics: true }).configuration, []);
});
test("Journalism tasks, creation and detail exclusively activate Journalism", () => {
  for (const route of ["/tasks?journalism=only", "/tasks?page=2&journalism=only", "/journalism/tasks/new", "/tasks/task-id?journalism=only"]) {
    assert.equal(isNavigationActive(route, "/tasks?journalism=only"), true, route);
    assert.equal(isNavigationActive(route, "/tasks"), false, route);
    assert.equal(isNavigationActive(route, "/tasks/assign"), false, route);
  }
  for (const route of ["/tasks", "/tasks?page=2", "/tasks/task-id"]) {
    assert.equal(isNavigationActive(route, "/tasks"), true);
    assert.equal(isNavigationActive(route, "/tasks?journalism=only"), false);
  }
  assert.equal(isNavigationActive("/tasks/assign", "/tasks/assign"), true);
  assert.equal(isNavigationActive("/tasks/assign?kind=journalism", "/tasks/assign"), false);
});
test("Journalism page routes select the correct child, including nested series", () => {
  for (const route of ["/journalism/calendar?view=week", "/journalism/reports", "/journalism/structures", "/journalism/structures/series-id"]) {
    const target = route.includes("structures") ? "/journalism/structures" : route.split("?")[0];
    assert.equal(isNavigationActive(route, target), true);
    assert.equal(isNavigationActive(route, "/tasks"), false);
    for (const other of ["/journalism/calendar", "/journalism/reports", "/journalism/structures"].filter(item => item !== target)) assert.equal(isNavigationActive(route, other), false);
  }
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

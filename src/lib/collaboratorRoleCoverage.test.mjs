import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { getPhase2Navigation } from "../components/phase2Navigation.ts";
import { canTaskAction } from "./authorization.ts";
import { normalizePermissions } from "./permissions.ts";
import { isAttendanceListedStaff } from "./attendanceVisibility.mjs";
import { isCollaboratorAllowedPath } from "./collaboratorRole.mjs";

const read = (path) => readFileSync(path, "utf8");
const id = "12345678-1234-4234-8234-123456789012";
const actor = { id, roleCode: "cong_tac_vien", departmentId: "department", roleLevel: 1, permissions: normalizePermissions({ can_comment: true, can_assign_task: true, can_view_department_tasks: true }) };
const task = { id: "task", departmentId: "department", createdBy: id, ownerId: id, assigneeId: null, reviewerId: null, participants: [], status: "in_progress", taskType: "assigned" };

test("CTV navigation ignores elevated legacy flags", () => {
  const nav = getPhase2Navigation({ roleCode: "cong_tac_vien", canAssignTask: true, canManageUsers: true, canManagePermissions: true, canManageRubrics: true, canEvaluateStep1: true, canEvaluateStep2: true, isDepartmentManager: true });
  assert.deepEqual(nav, { primary: [{ id: "tasks", href: "/my-tasks" }], account: [{ id: "account", href: "/account" }], journalism: [], configuration: [], showEvaluationTab: false });
});
test("CTV project navigation requires membership even with a create grant", () => {
  const access = { roleCode: "cong_tac_vien", canCreateProject: true };
  assert.equal(getPhase2Navigation(access).primary.some((item) => item.id === "projects"), false);
  assert.deepEqual(getPhase2Navigation({ ...access, hasProjectMembership: true }).primary, [{ id: "tasks", href: "/my-tasks" }, { id: "projects", href: "/projects" }]);
});
test("CTV project membership grants view and comment without management or task participation", () => {
  const memberTask = { ...task, projectId: "project", projectMembers: [{ userId: id, role: "member" }] };
  const trimmedActor = { ...actor, permissions: normalizePermissions({ can_comment: true }) };
  for (const action of ["view", "comment"]) assert.equal(canTaskAction(trimmedActor, memberTask, action), true, action);
  for (const action of ["assign", "update", "review", "evaluate", "claim", "report", "attachment", "complete_assigned"]) assert.equal(canTaskAction(trimmedActor, memberTask, action), false, action);
  assert.equal(canTaskAction(trimmedActor, { ...memberTask, projectMembers: [] }, "view"), false);
  assert.equal(canTaskAction(trimmedActor, { ...memberTask, assigneeId: id }, "report"), true);
});
test("creator, owner and department alone do not grant CTV task access", () => {
  assert.equal(canTaskAction(actor, task, "view"), false);
  for (const related of [{ assigneeId: id }, { reviewerId: id }, { participants: [{ userId: id, assignmentRole: "watcher" }] }, { participants: [{ userId: id, assignmentRole: "assignee" }] }]) {
    assert.equal(canTaskAction(actor, { ...task, ...related }, "view"), true);
    assert.equal(canTaskAction(actor, { ...task, ...related }, "comment"), true);
    for (const action of ["assign", "update", "review", "evaluate", "claim", "personal_edit", "assigned_cancel"]) assert.equal(canTaskAction(actor, { ...task, ...related }, action), false, action);
  }
  assert.equal(canTaskAction(actor, { ...task, assigneeId: id }, "report"), true);
  assert.equal(canTaskAction(actor, { ...task, assigneeId: id }, "complete_assigned"), true);
  assert.equal(canTaskAction(actor, { ...task, assigneeId: id, status: "done" }, "complete_assigned"), false);
});
test("CTV role is excluded from attendance regardless of title", () => {
  for (const staff of [{ roleCode: "cong_tac_vien" }, { role_code: "cong_tac_vien" }, { roles: { code: "cong_tac_vien" } }, { roles: [{ code: "cong_tac_vien" }] }]) assert.equal(isAttendanceListedStaff(staff), false);
  assert.equal(isAttendanceListedStaff({ roleCode: "nhan_vien" }), true);
});

const apiAllowlist = new Set(["version", "push/config", "push/subscribe", "push/unsubscribe", "mobile/push-token", "mobile/apk/latest", "mobile/apk/download", "auth/session", "auth/logout", "auth/mobile-logout", "account/profile", "account/password", "account/avatar", "tasks", "tasks/[id]", "tasks/[id]/comments", "tasks/[id]/attachments", "tasks/[id]/attachments/[attachmentId]", "tasks/[id]/progress-reports", "tasks/[id]/submit-completion", "projects", "projects/[id]", "projects/[id]/members", "projects/[id]/tasks", "projects/access", "projects/[id]/library", "projects/[id]/library/download/[itemId]"]);
test("every API route outside the explicit allowlist is covered by the central guard", () => {
  const proxy = read("src/proxy.ts");
  assert.match(proxy, /"\/api\/:path\*"/);
  assert.match(proxy, /isCollaboratorRole\(roleCode\) && !isCollaboratorAllowedPath\(pathname, request.method\)/);
  assert.match(proxy, /status: 403/);
  assert.match(proxy, /from\("staff_users"\)[\s\S]*select\("roles\(code\),active,session_version,must_change_password"\)/);
  const routes = readdirSync("src/app/api", { recursive: true }).map(String).map((p) => p.replaceAll("\\", "/")).filter((p) => p.endsWith("/route.ts")).map((p) => p.slice(0, -9));
  assert.ok(routes.length > 100);
  for (const route of routes) {
    const path = `/api/${route.replace(/\[[^\]]+\]/g, id)}`;
    const allowed = ["GET", "POST", "PATCH", "PUT", "DELETE"].some((method) => isCollaboratorAllowedPath(path, method));
    assert.equal(allowed, apiAllowlist.has(route), path);
  }
});
test("all pages outside task, account and project member views are denied", () => {
  const pages = readdirSync("src/app", { recursive: true }).map(String).map((p) => p.replaceAll("\\", "/")).filter((p) => p.endsWith("page.tsx"));
  for (const page of pages) {
    const route = "/" + page.replace(/\/?page.tsx$/, "");
    const allowed = ["/app", "/mobile-app", "/my-tasks", "/account", "/tasks/[id]", "/projects", "/projects/[id]"].includes(route);
    assert.equal(isCollaboratorAllowedPath(route.replace(/\[[^\]]+\]/g, id)), allowed, route);
  }
  assert.match(read("src/app/my-tasks/page.tsx"), /TasksPage searchParams=.*basePath="\/my-tasks"/);
});
test("users form and API accept database roles without a fixed seven-role list", () => {
  assert.match(read("src/app/api/users/route.ts"), /from\("roles"\).select\("id,code,name,level,active"\)/);
  assert.match(read("src/app/users/page.tsx"), /roles.filter\(\(r\) => r.active !== false\).map/);
});
test("migration grants only assigned task view/comment and rollback refuses referenced roles", () => {
  const sql = read("supabase/migrations/20261103150000_role_cong_tac_vien.sql");
  assert.match(sql, /'cong_tac_vien', 'Cộng tác viên', 1, true/);
  assert.match(sql, /on conflict \(code\)/);
  assert.match(sql, /p.code in \('task.view', 'task.comment'\)/);
  assert.match(sql, /select r.id, p.id, 'assigned'/);
  assert.match(sql, /can_create_task = false/);
  const revert = read("scripts/production/role-cong-tac-vien-revert.sql");
  assert.ok(revert.indexOf("raise exception") < revert.indexOf("delete from"));
  assert.match(revert, /lock table public.staff_users/);
});

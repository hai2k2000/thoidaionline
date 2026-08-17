import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("Admin manager configuration is server-only and same-origin", () => {
  const page = read("../app/configuration/department-managers/page.tsx");
  const route = read("../app/api/department-managers/route.ts");
  const repository = read("./departmentManagerRepository.ts");
  assert.match(page, /role_code\s*!==\s*["']admin["']/);
  assert.match(route, /departmentManagerHandlers/);
  assert.match(repository, /server-only/);
  assert.match(repository, /api_set_department_manager/);
  assert.doesNotMatch(page + route, /@\/lib\/supabase/);
});

test("manager configuration is present in the Admin-only navigation policy", () => {
  const navigation = read("../components/phase2Navigation.ts");
  const appNavigation = read("../components/AppNav.tsx");
  assert.match(navigation, /canManageUsers/);
  assert.match(navigation, /department-managers/);
  assert.match(appNavigation, /can_manage_users/);
  assert.match(appNavigation, /Tr\\u01b0\\u1edfng ph\\u00f2ng ch\\u00ednh/);
});

test("manager UI requires an explicit same-department selection", () => {
  const shell = read("../components/DepartmentManagerShell.tsx");
  assert.match(shell, /managerId/);
  assert.match(shell, /departmentId/);
  assert.match(shell, /Chưa có Trưởng phòng chính/);
  assert.doesNotMatch(shell, /auto.?assign|tự động gán/i);
});

test("manager RPC is audited and browser roles cannot execute it", () => {
  const sql = read("../../supabase/migrations/20260817110000_department_manager_prerequisite.sql");
  assert.match(sql, /api_set_department_manager/);
  assert.match(sql, /manager_id/);
  assert.match(sql, /audit_logs/);
  assert.match(sql, /from public,anon,authenticated/);
  assert.match(sql, /to service_role/);
});

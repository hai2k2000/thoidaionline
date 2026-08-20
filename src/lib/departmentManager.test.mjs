import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("legacy manager configuration redirects to employee job-title configuration", () => {
  const page = read("../app/configuration/department-managers/page.tsx");
  const route = read("../app/api/department-managers/route.ts");
  assert.match(page, /redirect\(user\.role_code === "admin" \? "\/users"/);
  assert.match(route, /status:\s*410/);
  assert.match(route, /chức vụ nhân sự/);
  assert.doesNotMatch(page + route, /@\/lib\/supabase/);
});

test("manager configuration is absent from navigation because job title is canonical", () => {
  const navigation = read("../components/phase2Navigation.ts");
  const appNavigation = read("../components/AppNav.tsx");
  assert.doesNotMatch(navigation, /department-managers/);
  assert.match(appNavigation, /can_manage_users/);
  assert.doesNotMatch(appNavigation, /Tr\\u01b0\\u1edfng ph\\u00f2ng ch\\u00ednh/);
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

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildPermissionMatrix } from "./permissionMatrix.ts";
import { hasPermission } from "./rbac/authorization.ts";

const roles = [
  { id: "role-admin", code: "admin", name: "Admin", level: 99, active: true },
  { id: "role-compat", code: "tbt_read_only", name: "TBT đọc", level: 3, active: false },
];
const permissions = [
  { id: "p-view", code: "task.view", name: "Xem công việc", module: "task", description: "Xem" },
  { id: "p-manage", code: "permission.manage", name: "Quản lý phân quyền", module: "permission", description: "Quản lý" },
];

test("matrix preserves inactive roles and roles with empty grants", () => {
  const matrix = buildPermissionMatrix(roles, permissions, [
    { role_id: "role-admin", permission_id: "p-view", scope: "all" },
  ]);
  assert.equal(matrix.length, 2);
  assert.equal(matrix[1].active, false);
  assert.deepEqual(matrix[1].modules.flatMap((module) => module.permissions.flatMap((permission) => permission.scopes)), []);
});

test("permission manager access denies anonymous and legacy admin inference", () => {
  assert.equal(hasPermission({ id: "admin", departmentId: null, grants: [] }, "permission.manage"), false);
});

test("permission manager access allows any authenticated actor with the explicit grant", () => {
  assert.equal(hasPermission({
    id: "not-hard-coded-admin",
    departmentId: null,
    grants: [{ permissionCode: "permission.manage", scope: "all" }],
  }, "permission.manage"), true);
});

test("matrix preserves multiple scopes without inferring other permissions", () => {
  const matrix = buildPermissionMatrix(roles, permissions, [
    { role_id: "role-admin", permission_id: "p-view", scope: "assigned" },
    { role_id: "role-admin", permission_id: "p-view", scope: "department" },
  ]);
  const taskView = matrix[0].modules.find((module) => module.key === "task").permissions.find((permission) => permission.code === "task.view");
  assert.deepEqual(taskView.scopes, ["assigned", "department"]);
  const manage = matrix[0].modules.find((module) => module.key === "permission").permissions.find((permission) => permission.code === "permission.manage");
  assert.deepEqual(manage.scopes, []);
});

test("permissions route requires server permission.manage and rejects all mutations", () => {
  const route = readFileSync("src/app/api/permissions/route.ts", "utf8");
  assert.match(route, /requireReadActor/);
  assert.match(route, /loadRbacActor/);
  assert.match(route, /hasPermission\([^\n]*permission\.manage/);
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.match(route, new RegExp(`export async function ${method}`));
    assert.match(route, new RegExp(`${method}[\\s\\S]{0,500}405`));
  }
  assert.doesNotMatch(route, /role_code\s*===\s*["']admin["']/);
  assert.match(route, /role_permission_grants/);
  assert.match(route, /permissions/);
});

test("permissions page is read-only and presents the role/module/permission/scope hierarchy", () => {
  const page = readFileSync("src/app/permissions/page.tsx", "utf8");
  assert.match(page, /ROLE|Vai trò/);
  assert.match(page, /MODULE|Mô-đun|module/i);
  assert.match(page, /PERMISSION|Quyền|permission/i);
  assert.match(page, /SCOPE|Phạm vi|scope/i);
  assert.doesNotMatch(page, /method:\s*["'](?:POST|PATCH|PUT|DELETE)["']/);
  assert.doesNotMatch(page, /Tạo vai trò|Thêm vai trò|Đổi tên|Khóa|Mở khóa/);
});

test("permissions layout has a server-side permission.manage gate", () => {
  const layout = readFileSync("src/app/permissions/layout.tsx", "utf8");
  assert.match(layout, /getSessionUser/);
  assert.match(layout, /loadRbacActor/);
  assert.match(layout, /permission\.manage/);
});

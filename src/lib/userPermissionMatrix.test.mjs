import assert from "node:assert/strict";
import test from "node:test";

const { buildPermissionUsers, buildQuickReportUserPermissions } = await import("./permissionMatrix.ts");

const permission = { id: "quick", code: "task.quick_report.create", name: "Quick Report", module: "task", description: null };
const users = [
  { id: "role-only", username: "role", full_name: "Role Only", active: true, role_id: "employee", roles: { code: "nhan_vien", name: "Nhân viên", active: true } },
  { id: "direct-only", username: "direct", full_name: "Direct Only", active: true, role_id: "employee", roles: { code: "nhan_vien", name: "Nhân viên", active: true } },
  { id: "both", username: "both", full_name: "Both", active: true, role_id: "employee", roles: { code: "nhan_vien", name: "Nhân viên", active: true } },
  { id: "neither", username: "neither", full_name: "Neither", active: true, role_id: "employee", roles: { code: "nhan_vien", name: "Nhân viên", active: true } },
];

test("effective Quick Report permission is role OR direct user grant", () => {
  const result = buildQuickReportUserPermissions(
    users,
    [permission],
    [{ role_id: "employee", permission_id: "quick", scope: "all" }],
    [{ user_id: "direct-only", permission_id: "quick" }, { user_id: "both", permission_id: "quick" }],
  );
  assert.deepEqual(result.map((entry) => [entry.id, entry.roleGranted, entry.directGranted, entry.effective]), [
    ["role-only", true, false, true],
    ["direct-only", true, true, true],
    ["both", true, true, true],
    ["neither", true, false, true],
  ]);
});

test("direct grant enables a user when no role grant exists", () => {
  const result = buildQuickReportUserPermissions(
    [users[1], users[3]],
    [permission],
    [],
    [{ user_id: "direct-only", permission_id: "quick" }],
  );
  assert.equal(result[0].effective, true);
  assert.equal(result[1].effective, false);
});

test("revoke of direct grant does not remove inherited role access", () => {
  const result = buildQuickReportUserPermissions(
    [users[0]],
    [permission],
    [{ role_id: "employee", permission_id: "quick", scope: "all" }],
    [],
  );
  assert.equal(result[0].roleGranted, true);
  assert.equal(result[0].directGranted, false);
  assert.equal(result[0].effective, true);
});


test("generic permission user builder resolves asset.manage without changing Quick Report compatibility", () => {
  const result = buildPermissionUsers(
    [users[0], users[1]],
    [{ id: "asset", code: "asset.manage", name: "Quản lý tài sản", module: "assets", description: null }],
    [{ role_id: "employee", permission_id: "asset", scope: "all" }],
    [{ user_id: "direct-only", permission_id: "asset" }],
    "asset.manage",
  );
  assert.deepEqual(result.map((entry) => [entry.id, entry.roleGranted, entry.directGranted, entry.effective]), [
    ["role-only", true, false, true],
    ["direct-only", true, true, true],
  ]);
});


test("inactive users keep persisted grant sources visible but are never effective", () => {
  const result = buildPermissionUsers(
    [{ id: "inactive", username: "inactive", full_name: "Inactive", active: false, role_id: "employee", roles: { code: "nhan_vien", name: "Nhân viên", active: true } }],
    [{ id: "asset", code: "asset.manage", name: "Quản lý tài sản", module: "assets", description: null }],
    [{ role_id: "employee", permission_id: "asset", scope: "all" }],
    [{ user_id: "inactive", permission_id: "asset" }],
    "asset.manage",
  );
  assert.deepEqual(result[0], {
    id: "inactive",
    username: "inactive",
    fullName: "Inactive",
    active: false,
    roleCode: "nhan_vien",
    roleName: "Nhân viên",
    roleActive: true,
    roleGranted: true,
    directGranted: true,
    effective: false,
  });
});

test("inactive role disables inherited access but does not hide a direct grant", () => {
  const result = buildPermissionUsers(
    [
      { id: "role-only", username: "role", full_name: "Role Only", active: true, role_id: "inactive-role", roles: { code: "old", name: "Old", active: false } },
      { id: "direct", username: "direct", full_name: "Direct", active: true, role_id: "inactive-role", roles: { code: "old", name: "Old", active: false } },
    ],
    [{ id: "asset", code: "asset.manage", name: "Quản lý tài sản", module: "assets", description: null }],
    [{ role_id: "inactive-role", permission_id: "asset", scope: "all" }],
    [{ user_id: "direct", permission_id: "asset" }],
    "asset.manage",
  );
  assert.equal(result[0].effective, false);
  assert.equal(result[0].roleGranted, true);
  assert.equal(result[1].effective, true);
  assert.equal(result[1].roleGranted, true);
  assert.equal(result[1].directGranted, true);
});

test("removing a direct grant leaves active inherited access effective", () => {
  const result = buildPermissionUsers(
    [users[2]],
    [{ id: "asset", code: "asset.manage", name: "Quản lý tài sản", module: "assets", description: null }],
    [{ role_id: "employee", permission_id: "asset", scope: "all" }],
    [],
    "asset.manage",
  );
  assert.equal(result[0].directGranted, false);
  assert.equal(result[0].roleGranted, true);
  assert.equal(result[0].effective, true);
});

test("removing a role grant leaves active direct access effective", () => {
  const result = buildPermissionUsers(
    [users[2]],
    [{ id: "asset", code: "asset.manage", name: "Quản lý tài sản", module: "assets", description: null }],
    [],
    [{ user_id: "both", permission_id: "asset" }],
    "asset.manage",
  );
  assert.equal(result[0].roleGranted, false);
  assert.equal(result[0].directGranted, true);
  assert.equal(result[0].effective, true);
});

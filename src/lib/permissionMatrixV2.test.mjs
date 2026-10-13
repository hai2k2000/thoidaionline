import assert from "node:assert/strict";
import test from "node:test";

import { buildPermissionManagementPayload } from "./permissionMatrix.ts";

const roles = [
  { id: "r1", code: "admin", name: "Admin", level: 9, active: true },
  { id: "r2", code: "inactive", name: "Inactive", level: 1, active: false },
];
const permissions = [
  { id: "p1", code: "permission.manage", name: "Manage", module: "permission", description: null },
  { id: "p2", code: "task.view", name: "View", module: "task", description: null },
];
const roleGrants = [
  { role_id: "r1", permission_id: "p2", scope: "department" },
  { role_id: "r1", permission_id: "p2", scope: "assigned" },
];
const users = [
  { id: "u1", username: "one", full_name: "One", active: true, role_id: "r1", roles: { code: "admin", name: "Admin", active: true }, department_name: "News" },
  { id: "u2", username: "two", full_name: "Two", active: true, role_id: "r2", roles: { code: "inactive", name: "Inactive", active: false }, department_name: "Desk" },
];

test("catalog payload retains every permission, module, role scope, and affected user", () => {
  const payload = buildPermissionManagementPayload({ roles, permissions, roleGrants, users, userGrants: [] });
  assert.equal(payload.permissions.length, 2);
  assert.deepEqual(payload.modules.map((module) => module.key), ["permission", "task"]);
  assert.deepEqual(payload.roles[0].modules.find((module) => module.key === "task").permissions[0].scopes, ["department", "assigned"]);
  assert.deepEqual(payload.users[0].effective["task.view"].scopes, ["department", "assigned"]);
});

test("user deny, direct allow on inactive role, and inactive user resolve distinctly", () => {
  const payload = buildPermissionManagementPayload({
    roles,
    permissions,
    roleGrants,
    users: [...users, { ...users[0], id: "u3", active: false }],
    userGrants: [
      { user_id: "u1", permission_id: "p2", effect: "deny", scope: "all" },
      { user_id: "u2", permission_id: "p2", effect: "allow", scope: "self" },
      { user_id: "u3", permission_id: "p2", effect: "allow", scope: "all" },
    ],
  });
  assert.equal(payload.users[0].effective["task.view"].source, "user_deny");
  assert.deepEqual(payload.users[0].effective["task.view"].scopes, []);
  assert.deepEqual(payload.users[1].effective["task.view"], { scopes: ["self"], source: "user_allow", roleScopes: [] });
  assert.equal(payload.users[2].effective["task.view"].source, "none");
});

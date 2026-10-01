import assert from "node:assert/strict";
import test from "node:test";

const { buildQuickReportUserPermissions } = await import("./permissionMatrix.ts");

const permission = { id: "quick", code: "task.quick_report.create", name: "Quick Report", module: "task", description: null };
const users = [
  { id: "role-only", username: "role", full_name: "Role Only", active: true, role_id: "employee", roles: { code: "nhan_vien", name: "Nhân viên" } },
  { id: "direct-only", username: "direct", full_name: "Direct Only", active: true, role_id: "employee", roles: { code: "nhan_vien", name: "Nhân viên" } },
  { id: "both", username: "both", full_name: "Both", active: true, role_id: "employee", roles: { code: "nhan_vien", name: "Nhân viên" } },
  { id: "neither", username: "neither", full_name: "Neither", active: true, role_id: "employee", roles: { code: "nhan_vien", name: "Nhân viên" } },
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

import assert from "node:assert/strict";
import test from "node:test";
import { APPROVAL_PERMISSION_CODES, groupPermissions } from "./approvalPermissionView.mjs";
import { RBAC_PERMISSION_CODES } from "./rbac/permissionCatalog.ts";

const permissions = RBAC_PERMISSION_CODES.map((code) => ({ code, name: code }));

test("groups preserve the requested order and labels", () => {
  assert.deepEqual(groupPermissions(permissions).map((group) => group.label), [
    "Giao việc", "Dữ liệu (CSDL)", "Tài sản", "Chấm công & nghỉ phép",
    "Lịch & kế hoạch", "Báo chí", "Nhân sự & quản trị", "Phê duyệt đơn và kế hoạch",
  ]);
});

test("unknown permissions land in Khác", () => {
  const groups = groupPermissions([{ code: "mystery.read", name: "Mystery" }]);
  assert.deepEqual(groups.map((group) => group.label), ["Khác"]);
  assert.equal(groups[0].permissions[0].code, "mystery.read");
});

test("approval codes can be excluded from user groups but remain available for role groups", () => {
  const withoutApproval = groupPermissions(permissions.filter(({ code }) => !APPROVAL_PERMISSION_CODES.includes(code)));
  assert.equal(withoutApproval.some((group) => group.key === "approval"), false);
  assert.equal(groupPermissions(permissions).find((group) => group.key === "approval").permissions.length, 3);
});

test("every catalog code lands in exactly one group", () => {
  const grouped = groupPermissions(permissions).flatMap((group) => group.permissions.map(({ code }) => code));
  assert.deepEqual([...new Set(grouped)].sort(), [...RBAC_PERMISSION_CODES].sort());
  assert.equal(grouped.length, RBAC_PERMISSION_CODES.length);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const userUi = [
  "../components/permissions/UserListPanel.tsx",
  "../components/permissions/UserPermissionDetail.tsx",
  "../components/permissions/ApprovalPermissionsCard.tsx",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");

test("user UI exposes identity, role defaults, effective source, and three-state override", () => {
  assert.match(userUi, /Tìm tên hoặc tài khoản/);
  assert.match(userUi, /department_name/);
  assert.match(userUi, /role_name|role_code/);
  assert.match(userUi, /onGrant/);
  assert.match(userUi, /onRevoke/);
  assert.match(userUi, /override_count/);
});

test("inherit is targeted while restore-all is explicit", () => {
  assert.match(userUi, /clear_user_override/);
  assert.match(userUi, /restore_user_inheritance/);
  assert.match(userUi, /Khôi phục tất cả mặc định/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/permissions/page.tsx", import.meta.url), "utf8");

test("role UI renders database roles, module catalog, scopes, affected count, and save", () => {
  assert.match(page, /Vai trò trong database/);
  assert.match(page, /payload\.modules/);
  assert.match(page, /scopeOptions/);
  assert.match(page, /người dùng bị ảnh hưởng/);
  assert.match(page, /replace_role_permissions/);
  assert.match(page, /Lưu thay đổi/);
});

test("inactive role remains inspectable but cannot be edited", () => {
  assert.match(page, /disabled=\{!selectedRole\?\.active/);
});

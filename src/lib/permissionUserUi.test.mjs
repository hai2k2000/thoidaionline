import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/permissions/page.tsx", import.meta.url), "utf8");

test("user UI exposes identity, role defaults, effective source, and three-state override", () => {
  assert.match(page, /Tìm người dùng/);
  assert.match(page, /department_name/);
  assert.match(page, /Kế thừa/);
  assert.match(page, /Cấp riêng/);
  assert.match(page, /Chặn riêng/);
  assert.match(page, /sourceLabel/);
});

test("inherit is targeted while restore-all is explicit", () => {
  assert.match(page, /clear_user_override/);
  assert.match(page, /restore_user_inheritance/);
  assert.match(page, /Khôi phục tất cả mặc định/);
});

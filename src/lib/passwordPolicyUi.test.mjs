import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../components/AccountShell.tsx", import.meta.url), "utf8"); const policy = readFileSync(new URL("./passwordPolicy.ts", import.meta.url), "utf8");

test("account password form uses the shared full password policy hint", () => {
  assert.match(source, /PASSWORD_POLICY_HINT/);
  assert.match(source, /\{PASSWORD_POLICY_HINT\}/);
  assert.match(policy, /Mật khẩu phải có 12-128 ký tự, gồm chữ thường, chữ hoa, số và ký tự đặc biệt/);
  assert.match(source, /minLength=\{MIN_PASSWORD_LENGTH\}/);
  assert.match(source, /maxLength=\{MAX_PASSWORD_LENGTH\}/);
});

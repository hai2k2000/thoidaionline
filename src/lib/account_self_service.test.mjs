import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const account = readFileSync("src/components/AccountShell.tsx", "utf8");
const profile = readFileSync("src/app/api/account/profile/route.ts", "utf8");
const password = readFileSync("src/app/api/account/password/route.ts", "utf8");
test("account screen provides profile and password self-service", () => { assert.match(account, /Lưu thông tin/); assert.match(account, /Đổi mật khẩu/); assert.match(account, /currentPassword/); });
test("self-service APIs use the signed session actor", () => { for (const source of [profile,password]) { assert.match(source, /getSessionUser/); assert.match(source, /isSameOriginRequest/); } assert.match(password, /verifyPassword/); assert.match(password, /session_version/); });

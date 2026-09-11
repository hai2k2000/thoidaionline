import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const constant = read("./defaultPassword.ts");
const login = read("../app/api/auth/login/route.ts");
const accountPassword = read("../app/api/account/password/route.ts");
const users = read("../app/api/users/route.ts");
const migration = read("../../supabase/migrations/20260911083000_fix_first_login_default_password.sql");

test("web account flows share the documented first-login password", () => {
  assert.match(constant, /DEFAULT_FIRST_LOGIN_PASSWORD\s*=\s*"Thoidai@123456"/);
  for (const source of [login, accountPassword, users]) {
    assert.match(source, /DEFAULT_FIRST_LOGIN_PASSWORD/);
    assert.doesNotMatch(source, /["']123456["']/);
  }
});

test("migration repairs only unchanged first-login accounts and future defaults", () => {
  assert.match(migration, /latest\.action\s*=\s*'bulk_password_reset'/);
  assert.match(migration, /staff\.session_version\s*=\s*1/);
  assert.match(migration, /extensions\.crypt\('123456', staff\.password_hash\)\s*=\s*staff\.password_hash/);
  assert.match(migration, /lower\(staff\.username\)\s*<>\s*'admin'/);
  assert.match(migration, /extensions\.crypt\('Thoidai@123456', extensions\.gen_salt\('bf', 12\)\)/);
  assert.match(migration, /session_version\s*=\s*staff\.session_version\s*\+\s*1/);
  assert.match(migration, /first_login_default_password_repair/);
});

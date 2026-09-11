import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("first-login enforcement persists the flag and clears it after password changes", () => {
  const migration = read("../../supabase/migrations/20260911190000_enforce_first_login_password_change.sql");
  const accountPassword = read("../app/api/account/password/route.ts");
  assert.match(migration, /add column if not exists must_change_password boolean not null default false/);
  assert.match(migration, /must_change_password = true/);
  assert.match(migration, /must_change_password=false/);
  assert.match(accountPassword, /must_change_password: false/);
});

test("login returns the first-login requirement and routes it to account", () => {
  const login = read("../app/api/auth/login/route.ts");
  const page = read("../app/login/page.tsx");
  assert.match(login, /mustChangePassword/);
  assert.match(page, /resolvePostLoginPath\(res\.mustChangePassword === true\)/);
});

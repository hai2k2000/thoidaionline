import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const webRoute = read("../app/api/auth/login/route.ts");
const mobileRoute = read("../app/api/auth/mobile-login/route.ts");
const credentials = read("./authenticateCredentials.ts");
const authClient = read("./auth.tsx");

test("login preserves exact password input in web and mobile routes", () => {
  for (const source of [webRoute, mobileRoute]) {
    assert.match(source, /const password = body\.password;/);
    assert.doesNotMatch(source, /body\.password\.trim\(\)/);
  }
});

test("bcrypt rejects a normalized variant of an exact stored password", async () => {
  const password = " Correct#Password1 ";
  const hash = await bcrypt.hash(password, 4);
  assert.equal(await bcrypt.compare(password, hash), true);
  assert.equal(await bcrypt.compare(password.trim(), hash), false);
});

test("credential verification preserves exact password material", () => {
  assert.match(credentials, /const password = passwordInput;/);
  assert.match(credentials, /\(row\.password \?\? DEFAULT_FIRST_LOGIN_PASSWORD\) === password/);
  assert.doesNotMatch(credentials, /passwordInput\.trim\(\)/);
});

test("web client sends the password without normalization", () => {
  assert.match(authClient, /\n\s*password,\n/);
  assert.doesNotMatch(authClient, /password: password\.trim\(\)/);
});

test("login routes distinguish temporary auth backend failures from bad credentials", () => {
  for (const source of [webRoute, mobileRoute]) {
    assert.match(source, /AuthenticationUnavailableError/);
    assert.match(source, /status: 503/);
    assert.match(source, /Retry-After/);
  }
  assert.match(credentials, /throw new AuthenticationUnavailableError\("credential_lookup_failed"\)/);
  assert.match(credentials, /throw new AuthenticationUnavailableError\("legacy_password_upgrade_failed"\)/);
});

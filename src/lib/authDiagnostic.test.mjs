import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const diagnostic = readFileSync(new URL("./authDiagnostic.ts", import.meta.url), "utf8");
const credentials = readFileSync(new URL("./authenticateCredentials.ts", import.meta.url), "utf8");
const login = readFileSync(new URL("../app/api/auth/login/route.ts", import.meta.url), "utf8");

test("diagnostic event is limited to safe fields and never logs credential material", () => {
  assert.match(diagnostic, /auth_diag/);
  assert.match(diagnostic, /password_length/);
  assert.match(diagnostic, /password_trim_changed/);
  assert.doesNotMatch(diagnostic, /passwordInput[^\n]*console/);
  assert.doesNotMatch(diagnostic, /password_hash/);
  assert.doesNotMatch(diagnostic, /SESSION_SECRET/);
  assert.doesNotMatch(diagnostic, /cookie|token/i);
  assert.match(diagnostic, /JSON\.stringify\(state\.event\)/);
});

test("bcrypt diagnostics record only reach/result/category and preserve generic client failure", () => {
  assert.match(credentials, /verifier_reached: true/);
  assert.match(credentials, /verifier_result: valid/);
  assert.match(credentials, /bcrypt_mismatch/);
  assert.match(login, /status: 401/);
  assert.doesNotMatch(login, /diagnostic.*NextResponse|NextResponse.*diagnostic/i);
});

test("legacy password upgrade is blocked while diagnostics are enabled", () => {
  assert.match(credentials, /AUTH_DIAGNOSTIC_BLOCK_LEGACY_UPGRADE/);
  assert.match(credentials, /legacy_upgrade_result: false/);
});

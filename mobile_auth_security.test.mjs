import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const auth = readFileSync("mobile/thoidai_work_flutter/lib/services/auth_service.dart", "utf8");
const work = readFileSync("mobile/thoidai_work_flutter/lib/services/work_service.dart", "utf8");
const main = readFileSync("mobile/thoidai_work_flutter/lib/main.dart", "utf8");
const mobileLogin = readFileSync("src/app/api/auth/mobile-login/route.ts", "utf8");

test("mobile authentication uses a server session instead of reading passwords from Supabase", () => {
  assert.doesNotMatch(auth, /staff_users.*password|select\([\s\S]*password/);
  assert.match(auth, /api\/auth\/mobile-login/);
  assert.match(auth, /FlutterSecureStorage/);
  assert.match(auth, /write\(key:\s*_tokenKey,\s*value:\s*token\)/);
  assert.match(auth, /api\/auth\/session/);
});

test("mobile work data is loaded through authenticated server APIs", () => {
  assert.doesNotMatch(work, /from\('staff_users'\)|from\('tasks'\)|from\('attendance_logs'\)/);
  assert.match(work, /api\/tasks/);
  assert.match(work, /api\/attendance/);
  assert.doesNotMatch(work, /return ''/);
});

test("mobile startup does not require a Supabase anon key", () => {
  assert.doesNotMatch(main, /Supabase\.initialize/);
  assert.doesNotMatch(main, /supabaseAnonKey/);
});

test("mobile login bounds requests and throttles repeated attempts", () => {
  assert.match(mobileLogin, /content-length/);
  assert.match(mobileLogin, /identifier\.length/);
  assert.match(mobileLogin, /password\.length/);
  assert.match(mobileLogin, /consumeLoginAttempt/);
  assert.match(mobileLogin, /status:\s*429/);
});

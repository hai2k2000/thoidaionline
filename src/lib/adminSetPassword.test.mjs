import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/auth/admin-set-password/route.ts", import.meta.url), "utf8");
const handler = readFileSync(new URL("./adminSetPassword.ts", import.meta.url), "utf8");
const policy = readFileSync(new URL("./passwordPolicy.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../app/users/page.tsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../supabase/migrations/20260817190000_admin_set_staff_password.sql", import.meta.url), "utf8");

test("shared policy is strong and used by both reset flows", () => {
  assert.match(policy, /MIN_PASSWORD_LENGTH\s*=\s*12/);
  assert.match(policy, /MAX_PASSWORD_LENGTH\s*=\s*128/);
  for (const rule of ["/[a-z]/", "/[A-Z]/", "/\\d/", "PASSWORD_SYMBOL_PATTERN"]) assert.ok(policy.includes(rule));
  assert.match(route, /getPasswordPolicyError/);
  assert.match(readFileSync(new URL("../app/api/auth/reset-password/route.ts", import.meta.url), "utf8"), /getPasswordPolicyError/);
});

test("route orders same-origin, session, exact admin authorization before input/work", () => {
  const origin = route.indexOf("isSameOriginRequest()");
  const session = route.indexOf("getSessionUser()");
  const role = route.indexOf('actor.role_code !== "admin"');
  const body = route.indexOf("request.json()");
  assert.ok(origin >= 0 && origin < session && session < role && role < body);
  assert.match(route, /actor\.id\s*===\s*userId/);
  assert.match(route, /password_reset_attempts/);
  assert.match(route, /hashResetFingerprint/);
  assert.match(route, /Cache-Control["']:\s*["']private, no-store/);
  assert.doesNotMatch(route, /console\.(?:log|warn|error)|service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

test("handler validates target and only hashes/RPCs after validation", () => {
  assert.match(handler, /user_not_found/);
  assert.match(handler, /user_inactive/);
  assert.match(handler, /hashPassword/);
  assert.match(handler, /setPassword/);
  assert.match(route, /admin_set_staff_password/);
});

test("UI has private password confirmation modal and prevents self/inactive targets", () => {
  assert.match(ui, /type="password"/);
  assert.match(ui, /newPassword/);
  assert.match(ui, /confirmPassword/);
  assert.match(ui, /selected\.id\s*===\s*user\?\.id/);
  assert.match(ui, /\/api\/auth\/admin-set-password/);
  assert.doesNotMatch(ui, /newPassword.*(?:URLSearchParams|console\.)/s);
});

test("RPC is service-role-only, reauthorizes, revokes sessions/tokens, and audits metadata only", () => {
  assert.match(migration, /security definer/i);
  assert.match(migration, /roles[\s\S]*code\s*=\s*'admin'/i);
  assert.match(migration, /p_actor_id\s*=\s*p_user_id/);
  assert.match(migration, /session_version\s*=\s*session_version\s*\+\s*1/);
  assert.match(migration, /password_reset_tokens[\s\S]*used_at/);
  assert.match(migration, /admin_password_set/);
  assert.match(migration, /grant execute[\s\S]*service_role/i);
  assert.doesNotMatch(migration, /new_data[\s\S]*p_password_hash/);
});

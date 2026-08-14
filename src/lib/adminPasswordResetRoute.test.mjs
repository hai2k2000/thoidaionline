import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../app/api/auth/admin-reset/route.ts", import.meta.url),
  "utf8",
);

test("admin reset route enforces origin, session and exact admin role", () => {
  assert.match(source, /isSameOriginRequest\(\)/);
  assert.match(source, /getSessionUser\(\)/);
  assert.match(source, /actor\.role_code\s*!==\s*["']admin["']/);
  const originIndex = source.indexOf("isSameOriginRequest()");
  const sessionIndex = source.indexOf("getSessionUser()");
  const roleIndex = source.indexOf("actor.role_code !==");
  assert.ok(originIndex < sessionIndex && sessionIndex < roleIndex);
});

test("admin reset route exposes explicit safe error codes and no-store responses", () => {
  for (const code of [
    "invalid_request",
    "unauthenticated",
    "invalid_origin",
    "forbidden",
    "user_not_found",
    "user_inactive",
    "email_missing",
    "reset_prepare_failed",
    "audit_finalize_failed",
    "email_delivery_failed",
  ]) assert.match(source, new RegExp(code));
  assert.match(source, /Cache-Control["']:\s*["']private, no-store/);
});

test("admin reset route uses atomic prepare and finalize RPCs", () => {
  assert.match(source, /prepare_admin_password_reset/);
  assert.match(source, /finalize_admin_password_reset/);
  assert.match(source, /executeAdminPasswordReset/);
});

test("admin reset route safely maps unexpected workflow exceptions", () => {
  assert.match(
    source,
    /try\s*\{[\s\S]*executeAdminPasswordReset[\s\S]*\}\s*catch\s*\{[\s\S]*code:\s*["']reset_prepare_failed["']/,
  );
  assert.doesNotMatch(source, /console\.(?:error|warn|log)/);
});

test("admin reset route validates UUIDs and delegates target eligibility", () => {
  assert.match(source, /UUID_PATTERN/);
  assert.match(source, /typeof body\?\.userId === ["']string["']/);
  assert.match(source, /getAdminResetTargetError\(data\)/);
  assert.doesNotMatch(source, /createResetRecord/);
});

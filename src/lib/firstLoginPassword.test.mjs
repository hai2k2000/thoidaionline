import assert from "node:assert/strict";
import test from "node:test";

import {
  getFirstLoginGateDecision,
  resolvePostLoginPath,
} from "./firstLoginPassword.ts";

test("first-login accounts are sent to the required password-change screen", () => {
  assert.equal(resolvePostLoginPath(true), "/account?changePassword=required");
  assert.equal(resolvePostLoginPath(false), "/tasks");
});

test("first-login gate permits only session, logout, and password change", () => {
  for (const path of [
    "/account",
    "/api/account/password",
    "/api/auth/logout",
    "/api/auth/session",
  ]) {
    assert.deepEqual(getFirstLoginGateDecision(path, true), { type: "allow" });
  }

  assert.deepEqual(getFirstLoginGateDecision("/tasks", true), {
    type: "redirect",
    location: "/account?changePassword=required",
  });
  assert.deepEqual(getFirstLoginGateDecision("/api/tasks", true), {
    type: "reject-api",
  });
});

test("normal accounts are not restricted by the first-login gate", () => {
  assert.deepEqual(getFirstLoginGateDecision("/tasks", false), { type: "allow" });
  assert.deepEqual(getFirstLoginGateDecision("/api/tasks", false), { type: "allow" });
});

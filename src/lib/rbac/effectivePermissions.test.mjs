import assert from "node:assert/strict";
import test from "node:test";
import { resolveEffectivePermission } from "./authorization.ts";

test("active user inherits active role scopes", () => {
  assert.deepEqual(resolveEffectivePermission({
    active: true,
    roleActive: true,
    roleScopes: ["department"],
    userEffect: null,
    userScope: null,
  }), {
    permissionCode: "",
    roleScopes: ["department"],
    userEffect: null,
    userScope: null,
    effectiveScopes: ["department"],
    source: "role",
  });
});

test("direct allow remains effective when the role is inactive", () => {
  const result = resolveEffectivePermission({
    active: true,
    roleActive: false,
    roleScopes: ["all"],
    userEffect: "allow",
    userScope: "self",
  });
  assert.deepEqual(result.effectiveScopes, ["self"]);
  assert.equal(result.source, "user_allow");
});

test("explicit deny overrides role and direct allow", () => {
  const result = resolveEffectivePermission({
    active: true,
    roleActive: true,
    roleScopes: ["all"],
    userEffect: "deny",
    userScope: "all",
  });
  assert.deepEqual(result.effectiveScopes, []);
  assert.equal(result.source, "user_deny");
});

test("inactive users have no effective permission", () => {
  const result = resolveEffectivePermission({
    active: false,
    roleActive: true,
    roleScopes: ["all"],
    userEffect: "allow",
    userScope: "all",
  });
  assert.deepEqual(result.effectiveScopes, []);
  assert.equal(result.source, "none");
});
test("active user without override does not inherit inactive role", () => {
  const result = resolveEffectivePermission({
    active: true,
    roleActive: false,
    roleScopes: ["all"],
    userEffect: null,
    userScope: null,
  });
  assert.deepEqual(result.effectiveScopes, []);
  assert.equal(result.source, "none");
});

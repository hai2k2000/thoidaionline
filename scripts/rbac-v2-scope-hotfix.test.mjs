import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("scope ambiguity hotfix is additive and preserves the RBAC RPC contract", () => {
  const historical = readFileSync("supabase/migrations/20261015100000_rbac_v2_role_user_overrides.sql", "utf8");
  const hotfix = readFileSync("supabase/migrations/20261015110000_rbac_v2_scope_ambiguity_fix.sql", "utf8");
  assert.match(historical, /cross join lateral unnest\(e\.effective_scopes\) as scope/);
  assert.match(hotfix, /returns table\(permission_code text, scope text\)/i);
  assert.match(hotfix, /expanded\(granted_scope\)/);
  assert.match(hotfix, /expanded\.granted_scope/);
  assert.match(hotfix, /security definer/i);
  assert.match(hotfix, /set search_path = public, pg_temp/i);
  assert.doesNotMatch(hotfix, /drop function/i);
});

test("hotfix references the exact migration in artifact contracts", () => {
  for (const file of ["scripts/package-standalone.mjs", "scripts/verify-standalone-artifact.mjs"]) {
    assert.ok(readFileSync(file, "utf8").includes("20261015110000_rbac_v2_scope_ambiguity_fix.sql"), file);
  }
});

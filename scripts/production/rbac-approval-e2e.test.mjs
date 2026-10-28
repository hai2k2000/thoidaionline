import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rig = readFileSync("scripts/production/rbac-approval-e2e-rig.sh", "utf8");
const seed = readFileSync("supabase/tests/rbac_approval_v1_e2e_seed.sql", "utf8");
const matrix = readFileSync("scripts/production/rbac-approval-e2e-matrix.mjs", "utf8");

test("rig is approval-gated and isolated", () => {
  assert.match(rig, /THOIDAI_RBAC_E2E_APPROVED/); assert.match(rig, /disk-guard\.sh/);
  assert.match(rig, /leftover container exists/); assert.match(rig, /127\.0\.0\.1:/);
  assert.match(rig, /--memory 512m/); assert.match(rig, /rbac-e2e-net/); assert.match(rig, /main "\$@" <\/dev\/null/);
  assert.doesNotMatch(rig, /supabase_db_thoidai-work/);
  assert.doesNotMatch(rig, /docker\s+(?:inspect|top)\b/); assert.doesNotMatch(rig, /echo[^\n]*(?:RBAC_E2E_JWT_SECRET|RBAC_E2E_PASSWORD)/);
});

test("seed is disposable and does not pre-grant overrides", () => {
  assert.match(seed, /zz_e2e_/); assert.doesNotMatch(seed, /user_permission_grants\s*\(/i); assert.match(seed, /e2e_password/);
});

test("proxy and matrix protect credentials and preserve origin", () => {
  assert.match(matrix, /Origin|origin/); assert.match(matrix, /RBAC_E2E_PASSWORD/);
  assert.doesNotMatch(matrix, /console\.log\([^\n]*(?:password|cookie|secret)/i);
});

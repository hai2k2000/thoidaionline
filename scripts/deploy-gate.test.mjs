import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("scripts/production/deploy-gate.sh", "utf8");
test("deploy gate has disk guard, one lock, atomic activation, and post-health rollback", () => {
  for (const pattern of ["hard_min_free_kb=${THOIDAI_HARD_MIN_FREE_KB:-20971520}", "invalid disk gate values", "verify-standalone-artifact.mjs", "exec 9>", "flock -n 9", "for attempt in $(seq 1 \"$health_attempts\")", "current_target=", "rollback-1", "rollback-2", "df -Pk", "mv_bin", "rollback_snapshot", "contract-smoke.mjs", "chown_bin", "install_bin"]) assert.ok(source.includes(pattern), pattern);
});

test("deploy gate exposes browser-path and proxy-buffer gates", () => {
  assert.ok(source.includes("browser-path-smoke.mjs"), "browser-path smoke gate missing");
  assert.ok(source.includes("nginx-supa-buffer-guard.sh"), "Supabase proxy buffer guard missing");
});

test("production activation requires authenticated smoke and restores the full pointer snapshot on failure", () => {
  assert.match(source, /authenticated smoke credentials are required/);
  assert.match(source, /contract-smoke\.mjs/);
  assert.match(source, /browser-path-smoke\.mjs/);
  assert.doesNotMatch(source, /flock -u 9/);
  assert.doesNotMatch(source, /rollback-application\.sh/);
});

test("automatic rollback checks RBAC compatibility before restoring an older target", () => {
  assert.match(source, /check-rbac-rollback-compatibility\.sh/);
  assert.match(source, /rbac rollback compatibility/i);
  assert.match(source, /RBAC rollback compatibility gate failed for rollback target/i);
  assert.match(source, /automatic rollback blocked by RBAC compatibility gate/i);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("scripts/production/deploy-gate.sh", "utf8");
test("deploy gate has disk guard, one lock, atomic activation, and post-health rollback", () => {
  for (const pattern of ["source \"$script_dir/disk-guard.sh\"", "disk_guard_require", "verify-standalone-artifact.mjs", "exec 9>", "flock -n 9", "for attempt in $(seq 1 \"$health_attempts\")", "current_target=", "rollback-1", "rollback-2", "df -Pk", "mv_bin", "rollback_snapshot", "contract-smoke.mjs", "chown_bin", "chmod_bin", "runuser_bin", "permission_check", "install_bin"]) assert.ok(source.includes(pattern), pattern);
});

test("deploy gate exposes browser-path and proxy-buffer gates", () => {
  assert.ok(source.includes("browser-path-smoke.mjs"), "browser-path smoke gate missing");
  assert.ok(source.includes("nginx-supa-buffer-guard.sh"), "Supabase proxy buffer guard missing");
});

test("high-risk production activation requires authenticated smoke and restores the full pointer snapshot on failure", () => {
  assert.match(source, /authenticated smoke credentials are required/);
  assert.match(source, /contract-smoke\.mjs/);
  assert.match(source, /browser-path-smoke\.mjs/);
  assert.doesNotMatch(source, /flock -u 9/);
  assert.doesNotMatch(source, /rollback-application\.sh/);
});

test("low-risk artifacts can skip authenticated smoke only with sealed automated evidence", () => {
  assert.match(source, /risk_class/);
  assert.match(source, /risk_test_evidence/);
  assert.match(source, /risk_class=low, automated-tests-pass/);
  assert.match(source, /smoke_required=0/);
  assert.match(source, /smoke_required == 1/);
});

test("automatic rollback checks RBAC compatibility before restoring an older target", () => {
  assert.match(source, /check-rbac-rollback-compatibility\.sh/);
  assert.match(source, /rbac rollback compatibility/i);
  assert.match(source, /RBAC rollback compatibility gate failed for rollback target/i);
  assert.match(source, /automatic rollback blocked by RBAC compatibility gate/i);
});

test("controlled smoke waiver is explicit, single-use, and still records a non-pass smoke status", () => {
  assert.match(source, /THOIDAI_AUTHENTICATED_SMOKE_WAIVER/);
  assert.match(source, /controlled-deploy-exception\.mjs/);
  assert.match(source, /AUTHENTICATED_SMOKE=WAIVED/);
  assert.match(source, /approval.*commit/i);
  assert.match(source, /invalid, stale, or already used/i);
  assert.match(source, /artifact\/scripts\/production\/controlled-deploy-exception\.mjs/);
  assert.match(source, /check-rbac-rollback-compatibility\.sh[\s\S]*controlled-deploy-exception\.mjs/);
  assert.match(source, /THOIDAI_RBAC_READINESS_EVIDENCE/);
  assert.match(source, /controlled-deploy-exception\.mjs/);
  assert.match(source, /readiness_path/);
});

test("release permissions are checked before waiver consumption", () => {
  assert.match(source, /service user cannot traverse/);
  assert.match(source, /service user cannot read runtime path/);
  assert.match(source, /service user cannot write runtime cache/);
  assert.ok(source.indexOf("permission_check -x") < source.indexOf("controlled-deploy-exception.mjs"));
});

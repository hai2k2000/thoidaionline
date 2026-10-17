import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("scripts/production/deploy-gate.sh", "utf8");
test("deploy gate has disk guard, one lock, atomic activation, and post-health rollback", () => {
  for (const pattern of ["source \"$script_dir/disk-guard.sh\"", "disk_guard_require", "verify-standalone-artifact.mjs", "exec 9>", "flock -n 9", "for attempt in $(seq 1 \"$health_attempts\")", "current_target=", "rollback-1", "rollback-2", "df -Pk", "mv_bin", "rollback_snapshot", "chown_bin", "chmod_bin", "runuser_bin", "permission_check", "install_bin"]) assert.ok(source.includes(pattern), pattern);
});

test("deploy gate preserves the proxy-buffer safety gate", () => {
  assert.ok(source.includes("nginx-supa-buffer-guard.sh"), "Supabase proxy buffer guard missing");
});

test("high-risk production activation remains credential-independent and restores the full pointer snapshot on failure", () => {
  assert.match(source, /authenticated smoke: OPTIONAL/);
  assert.match(source, /OPTIONAL_AUTHENTICATED_SMOKE=SKIP/);
  assert.doesNotMatch(source, /authenticated smoke credentials are required/);
  assert.doesNotMatch(source, /controlled-deploy-exception\.mjs/);
  assert.doesNotMatch(source, /flock -u 9/);
  assert.doesNotMatch(source, /rollback-application\.sh/);
});

test("risk classification remains technical metadata while smoke stays optional", () => {
  assert.match(source, /risk_class/);
  assert.match(source, /risk_test_evidence/);
  assert.match(source, /smoke_required=0/);
  assert.match(source, /OPTIONAL_AUTHENTICATED_SMOKE=SKIP/);
});

test("automatic rollback checks RBAC compatibility before restoring an older target", () => {
  assert.match(source, /check-rbac-rollback-compatibility\.sh/);
  assert.match(source, /rbac rollback compatibility/i);
  assert.match(source, /RBAC rollback compatibility gate failed for rollback target/i);
  assert.match(source, /automatic rollback blocked by RBAC compatibility gate/i);
});

test("controlled smoke waiver and RBAC smoke evidence are not activation requirements", () => {
  assert.doesNotMatch(source, /THOIDAI_AUTHENTICATED_SMOKE_WAIVER/);
  assert.doesNotMatch(source, /THOIDAI_RBAC_READINESS_EVIDENCE/);
  assert.doesNotMatch(source, /controlled-deploy-exception\.mjs/);
});

test("release permissions are checked before activation mutation", () => {
  assert.match(source, /service user cannot traverse/);
  assert.match(source, /service user cannot read runtime path/);
  assert.match(source, /service user cannot write runtime cache/);
  assert.ok(source.indexOf("permission_check -x") < source.indexOf("deploy-gate: PASS"));
});

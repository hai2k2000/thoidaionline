import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("scripts/production/deploy-gate.sh", "utf8");
test("deploy gate has disk guard, lock, atomic activation, and post-health rollback", () => {
  for (const pattern of ["hard_min_free_kb=${THOIDAI_HARD_MIN_FREE_KB:-20971520}", "invalid disk gate values", "node \"$artifact/verify-standalone-artifact.mjs\"", "flock", "flock -u 9", "for attempt in $(seq 1 30)", "current_target=", "-d \"$rollback_1_target\"", "-d \"$rollback_2_target\"", "rollback-1", "rollback-2", "df -Pk", "mv -Tf", "rollback-application.sh", "contract-smoke.mjs", "chown", "install -d"]) assert.ok(source.includes(pattern), pattern);
});

test("deploy gate exposes browser-path and proxy-buffer gates", () => {
  assert.ok(source.includes("browser-path-smoke.mjs"), "browser-path smoke gate missing");
  assert.ok(source.includes("nginx-supa-buffer-guard.sh"), "Supabase proxy buffer guard missing");
});

test("production activation requires authenticated smoke and restores the full pointer snapshot on failure", () => {
  assert.match(source, /authenticated smoke credentials are required/);
  assert.match(source, /if ! node scripts\/contract-smoke\.mjs/);
  assert.match(source, /if ! node scripts\/production\/browser-path-smoke\.mjs/);
  for (const name of ["THOIDAI_ROLLBACK_CURRENT_TARGET", "THOIDAI_ROLLBACK_PREVIOUS_TARGET", "THOIDAI_ROLLBACK_1_TARGET", "THOIDAI_ROLLBACK_2_TARGET"]) {
    assert.match(source, new RegExp(name));
  }
  assert.match(source, /ln -sfn -- "\$current_target" "\$release_root\/rollback-1\.new"/);
});

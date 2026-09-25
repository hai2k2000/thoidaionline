import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("scripts/production/deploy-gate.sh", "utf8");
test("deploy gate has disk guard, lock, atomic activation, and post-health rollback", () => {
  for (const pattern of ["flock", "flock -u 9", "for attempt in $(seq 1 30)", "current_target=", "-d \"$rollback_1_target\"", "-d \"$rollback_2_target\"", "rollback-1", "rollback-2", "df -Pk", "mv -Tf", "rollback-application.sh", "contract-smoke.mjs", "chown", "install -d"]) assert.ok(source.includes(pattern), pattern);
});

test("deploy gate exposes browser-path and proxy-buffer gates", () => {
  assert.ok(source.includes("browser-path-smoke.mjs"), "browser-path smoke gate missing");
  assert.ok(source.includes("nginx-supa-buffer-guard.sh"), "Supabase proxy buffer guard missing");
});

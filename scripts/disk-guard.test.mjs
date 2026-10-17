import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = readFileSync("deploy/disk-guard.conf", "utf8");
const deployGate = readFileSync("scripts/production/deploy-gate.sh", "utf8");
const buildGate = readFileSync("scripts/production/build-standalone-release.sh", "utf8");

test("disk policy is centralized and consumed by build and deploy", () => {
  assert.match(config, /THOIDAI_DISK_HARD_MIN_KB=10485760/);
  assert.match(config, /THOIDAI_DISK_WARNING_KB=20971520/);
  assert.match(config, /THOIDAI_DISK_DEFAULT_HEADROOM_KB=1048576/);
  assert.match(deployGate, /disk_guard_require/);
  assert.match(buildGate, /disk_guard_require/);
});

function check(freeGiB, estimatedGiB = 0) {
  const result = spawnSync("bash", ["-c", "source scripts/production/disk-guard.sh; disk_guard_require \"$1\" \"$2\" test", "--", String(freeGiB * 1024 * 1024), String(estimatedGiB * 1024 * 1024)], { encoding: "utf8" });
  return { ...result, output: `${result.stdout}${result.stderr}` };
}

test("23 GiB passes", () => { const r=check(23); assert.equal(r.status,0); assert.match(r.output,/PASS/); });
test("15 GiB passes with warning", () => { const r=check(15); assert.equal(r.status,0); assert.match(r.output,/WARNING/); });
test("10 GiB passes with no estimated writes", () => { const r=check(10); assert.equal(r.status,0); assert.match(r.output,/WARNING/); });
test("9 GiB is blocked", () => { const r=check(9); assert.notEqual(r.status,0); assert.match(r.output,/BLOCKED/); });
test("12 GiB with 3 GiB estimated writes is blocked", () => { const r=check(12,3); assert.notEqual(r.status,0); assert.match(r.output,/BLOCKED/); });

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("scripts/production/deploy-gate.sh", "utf8");
test("deploy gate has disk guard, lock, atomic activation, and post-health rollback", () => {
  for (const pattern of ["flock", "df -Pk", "mv -Tf", "rollback-application.sh", "contract-smoke.mjs", "chown", "install -d"]) assert.ok(source.includes(pattern), pattern);
});



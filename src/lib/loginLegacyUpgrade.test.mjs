import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../app/api/auth/login/route.ts", import.meta.url),
  "utf8",
);

test("legacy password upgrade uses compare-and-swap before issuing a session", () => {
  assert.match(source, /\.eq\("session_version", row\.session_version\)/);
  assert.match(source, /row\.password_hash === null[\s\S]*\.is\("password_hash", null\)[\s\S]*\.eq\("password_hash", row\.password_hash\)/);
  assert.match(source, /row\.password === null[\s\S]*\.is\("password", null\)[\s\S]*\.eq\("password", row\.password\)/);
  assert.match(source, /\.select\("id"\)\s*\.maybeSingle\(\)/);
  assert.match(source, /if \(upgradeError \|\| !upgraded\)[\s\S]*status: 401/);

  const lostRaceGuard = source.indexOf("if (upgradeError || !upgraded)");
  const sessionIssue = source.indexOf("createSessionToken(row.id, row.session_version)");
  assert.ok(lostRaceGuard >= 0 && sessionIssue > lostRaceGuard);
});

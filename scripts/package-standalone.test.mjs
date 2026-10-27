import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("standalone packaging includes the writable Next cache directory", () => {
  const packager = fs.readFileSync(new URL("./package-standalone.mjs", import.meta.url), "utf8");
  const verifier = fs.readFileSync(new URL("./verify-standalone-artifact.mjs", import.meta.url), "utf8");
  assert.match(packager, /mkdir\(join\(output, "\.next", "cache"\)/);
  assert.doesNotMatch(verifier, /"\.next\/cache"/);
});

test("standalone packaging measures artifact bytes without GNU-only du flags", () => {
  const packager = fs.readFileSync(new URL("./package-standalone.mjs", import.meta.url), "utf8");
  assert.match(packager, /const directoryBytes = async/);
  assert.doesNotMatch(packager, /du.*-sb/);
});

test("standalone packaging records automated test evidence only after a real Node test run", () => {
  const packager = fs.readFileSync(new URL("./package-standalone.mjs", import.meta.url), "utf8");
  assert.match(packager, /execFileSync\(process\.execPath, \["--test", \.\.\.automatedTestFiles\]/);
  assert.match(packager, /automatedTestFiles/);
  assert.match(packager, /classify-release-risk\.test\.mjs/);
  assert.match(packager, /anonAccessLockdown\.test\.mjs/);
  assert.match(packager, /safe-apply-migration\.test\.mjs/);
  assert.match(packager, /rbac-v2-scope-hotfix\.test\.mjs/);
  assert.match(packager, /assetAuthorization\.test\.mjs/);
  assert.ok(packager.indexOf("execFileSync(process.execPath, [\"--test\"") < packager.indexOf("await mkdir(output"));
  assert.match(packager, /status=PASS/);
  assert.match(packager, /THOIDAI_RISK_TEST_EVIDENCE: riskEvidencePath/);
  assert.match(packager, /risk_test_evidence/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("risk classifier is fail-closed without sealed test evidence", () => {
  // CI exports THOIDAI_RISK_TEST_EVIDENCE job-wide and package:standalone reruns this suite, so clear it explicitly.
  const output = execFileSync(process.execPath, ["scripts/classify-release-risk.mjs", process.cwd()], {
    encoding: "utf8",
    env: { ...process.env, THOIDAI_RISK_TEST_EVIDENCE: "" },
  });
  assert.match(output, /risk_class=high/);
  assert.match(output, /risk_test_evidence=missing-or-invalid/);
});
test("risk classifier accepts only commit-bound PASS evidence", () => {
  const dir = mkdtempSync(join(tmpdir(), "thoidai-risk-"));
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const evidence = join(dir, "tests.evidence");
  writeFileSync(evidence, `commit=${commit}\nstatus=PASS\n`);
  const output = execFileSync(process.execPath, ["scripts/classify-release-risk.mjs", process.cwd()], {
    encoding: "utf8",
    env: { ...process.env, THOIDAI_RISK_TEST_EVIDENCE: evidence },
  });
  assert.match(output, /risk_test_evidence=automated-tests-pass/);
});


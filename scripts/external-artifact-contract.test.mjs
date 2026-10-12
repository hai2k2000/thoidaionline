import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/production-artifact.yml", "utf8");
const deploy = readFileSync("scripts/production/deploy-external-artifact.sh", "utf8");
const packager = readFileSync("scripts/package-standalone.mjs", "utf8");

test("external artifact workflow builds without production secrets or deploy activation", () => {
  assert.match(workflow, /npm ci --no-audit --no-fund/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /npm run package:standalone/);
  assert.match(workflow, /scan-artifact-secrets\.mjs/);
  assert.doesNotMatch(workflow, /SUPABASE_SERVICE_ROLE_KEY:\s*\$\{\{\s*secrets\./);
  assert.doesNotMatch(workflow, /ssh|scp|rsync|deploy-external-artifact\.sh.*--activate/);
});

test("external deploy is verify-only by default and delegates activation to the existing gate", () => {
  assert.match(deploy, /mode=\$\{3:---verify-only\}/);
  assert.match(deploy, /THOIDAI_EXTERNAL_DEPLOY_APPROVED/);
  assert.match(deploy, /deploy-gate\.sh/);
  assert.doesNotMatch(deploy, /npm ci|npm run build|next build/);
  assert.match(packager, /env_model=\$\{runtimeEnvModel\}/);
});

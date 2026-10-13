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
  assert.match(workflow, /THOIDAI_RUNTIME_ENV_MODEL: runtime-injected/);
  assert.match(workflow, /retention-days: 14/);
  assert.match(workflow, /include-hidden-files: true/);
  assert.match(workflow, /actions\/download-artifact@v4/);
  assert.match(workflow, /verify-artifact-roundtrip\.mjs/);
  assert.doesNotMatch(workflow, /SUPABASE_SERVICE_ROLE_KEY:\s*\$\{\{\s*secrets\./);
  assert.doesNotMatch(workflow, /ssh|scp|rsync|deploy-external-artifact\.sh.*--activate/);
});

test("external deploy is verify-only by default and delegates activation to the existing gate", () => {
  assert.match(deploy, /mode=\$\{3:---verify-only\}/);
  assert.match(deploy, /THOIDAI_EXTERNAL_DEPLOY_APPROVED/);
  assert.match(deploy, /deploy-gate\.sh/);
  assert.doesNotMatch(deploy, /npm ci|npm run build|next build/);
  assert.match(packager, /env_model=\$\{runtimeEnvModel\}/);
  assert.match(packager, /build_config=\$\{buildConfig\}/);
  assert.match(deploy, /production activation rejects non-canonical public build config/);
});

test("CI placeholder artifacts are verification-only and cannot activate", () => {
  assert.match(workflow, /THOIDAI_BUILD_CONFIG:[^\n]*ci-placeholder/);
  assert.match(deploy, /build_config=.*\.release-meta/);
  assert.match(deploy, /\[\[ \"\$build_config\" == canonical-public \]\]/);
});

test("artifact boundary enforces provenance and the production disk floor", () => {
  assert.match(deploy, /verify-standalone-artifact\.mjs/);
  assert.match(deploy, /artifact provenance does not match expected commit/);
  const gate = readFileSync("scripts/production/deploy-gate.sh", "utf8");
  assert.match(gate, /hard_min_free_kb=\$\{THOIDAI_HARD_MIN_FREE_KB:-20971520\}/);
  assert.match(gate, /free_kb - estimated_headroom_kb/);
  assert.match(gate, /build config is not canonical-public/);
});

test("controlled deployment exception remains opt-in and delegated to the gate", () => {
  assert.match(deploy, /THOIDAI_AUTHENTICATED_SMOKE_WAIVER/);
  assert.match(deploy, /deploy-gate\.sh/);
  assert.match(deploy, /THOIDAI_RBAC_READINESS_EVIDENCE/);
  assert.doesNotMatch(workflow, /THOIDAI_AUTHENTICATED_SMOKE_WAIVER/);
});

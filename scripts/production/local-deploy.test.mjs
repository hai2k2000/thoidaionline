import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./local-deploy.sh", import.meta.url), "utf8");

test("local deploy builds from canonical source and transfers through strict SSH", () => {
  for (const pattern of [
    "fetch \"$remote_name\"",
    "worktree add --detach",
    "npm ci --no-audit --no-fund",
    "npm run build",
    "artifact-manifest.mjs",
    "scan-artifact-secrets.mjs",
    "StrictHostKeyChecking=yes",
    "sha256sum",
    "deploy-external-artifact.sh",
  ]) assert.ok(source.includes(pattern), pattern);
});

test("local deploy refuses missing canonical public configuration and defaults to verify-only", () => {
  assert.match(source, /mode=\$\{1:---verify-only\}/);
  assert.match(source, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(source, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.match(source, /THOIDAI_EXTERNAL_DEPLOY_APPROVED/);
});

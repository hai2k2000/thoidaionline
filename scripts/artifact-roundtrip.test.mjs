import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/production-artifact.yml", "utf8");

test("artifact upload includes hidden provenance and performs a verified download round-trip", () => {
  assert.match(workflow, /include-hidden-files: true/);
  assert.match(workflow, /actions\/download-artifact@v4/);
  assert.match(workflow, /materialize-artifact-symlinks\.mjs/);
  assert.match(workflow, /artifact-manifest\.mjs/);
  assert.match(workflow, /\.release-meta/);
  assert.match(workflow, /\.artifact-manifest\.json/);
  assert.match(workflow, /\.artifact-manifest\.sha256/);
  assert.match(workflow, /mkdir -p "\$root\/\.next\/cache"/);
  assert.match(workflow, /verify-standalone-artifact\.mjs/);
  assert.match(workflow, /scan-artifact-secrets\.mjs/);
  assert.match(workflow, /verify-artifact-roundtrip\.mjs/);
  assert.doesNotMatch(workflow, /--activate/);
});

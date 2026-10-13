import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/production-artifact.yml", "utf8");
const verifier = readFileSync("scripts/verify-standalone-artifact.mjs", "utf8");
const packager = readFileSync("scripts/package-standalone.mjs", "utf8");

test("artifact upload includes hidden provenance and performs a verified download round-trip", () => {
  assert.match(workflow, /include-hidden-files: true/);
  assert.match(workflow, /actions\/download-artifact@v4/);
  assert.match(workflow, /materialize-artifact-symlinks\.mjs/);
  assert.match(workflow, /artifact-manifest\.mjs/);
  assert.match(workflow, /rm -f .*\.artifact-manifest\.json.*\.artifact-manifest\.sha256/);
  assert.match(workflow, /\.release-meta/);
  assert.match(workflow, /\.artifact-manifest\.json/);
  assert.match(workflow, /\.artifact-manifest\.sha256/);
  assert.doesNotMatch(workflow, /mkdir -p "\$root\/\.next\/cache"/);
  assert.match(workflow, /verify-standalone-artifact\.mjs/);
  assert.match(workflow, /scan-artifact-secrets\.mjs/);
  assert.match(workflow, /verify-artifact-roundtrip\.mjs/);
  assert.doesNotMatch(workflow, /--activate/);
});

test("runtime cache is created at packaging/runtime time, not required in uploaded artifact", () => {
  assert.match(packager, /mkdir\(join\(output, "\.next", "cache"\)/);
  assert.doesNotMatch(verifier, /\.next\/cache/);
});

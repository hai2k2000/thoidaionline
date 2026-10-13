import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("scripts/production/mark-release-success.sh", "utf8");
test("release success marker normalizes systemd symlink paths", () => {
  assert.match(source, /service_working_dir=\$\(realpath -m --/);
  assert.match(source, /release_path=\$\(realpath -m --/);
});

test("release success evidence does not rewrite immutable release metadata", () => {
  assert.doesNotMatch(source, /\.release-meta\.new/);
  assert.match(source, /release_meta_sha256=/);
  assert.match(source, /artifact_manifest_sha256=/);
  assert.match(source, /\.deploy-success/);
});

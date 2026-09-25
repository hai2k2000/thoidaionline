import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("scripts/production/mark-release-success.sh", "utf8");
test("release success marker normalizes systemd symlink paths", () => {
  assert.match(source, /service_working_dir=\$\(realpath -m --/);
  assert.match(source, /release_path=\$\(realpath -m --/);
});

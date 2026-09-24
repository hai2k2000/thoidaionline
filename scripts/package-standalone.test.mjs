import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("standalone packaging includes the writable Next cache directory", () => {
  const packager = fs.readFileSync(new URL("./package-standalone.mjs", import.meta.url), "utf8");
  const verifier = fs.readFileSync(new URL("./verify-standalone-artifact.mjs", import.meta.url), "utf8");
  assert.match(packager, /mkdir\(join\(output, "\.next", "cache"\)/);
  assert.match(verifier, /"\.next\/cache"/);
});

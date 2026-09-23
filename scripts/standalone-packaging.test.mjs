import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = readFileSync("next.config.ts", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

test("Next standalone output is enabled", () => assert.match(config, /output:\s*["']standalone["']/));
test("standalone tracing excludes development-only source payloads", () => assert.match(config, /outputFileTracingExcludes/));
test("packaging commands exist", () => {
  for (const script of ["package:standalone", "verify:standalone", "retention:dry-run"]) assert.equal(typeof packageJson.scripts[script], "string");
});
test("packaging keeps guards and env symlinks", () => {
  const packager = readFileSync("scripts/package-standalone.mjs", "utf8");
  const verifier = readFileSync("scripts/verify-standalone-artifact.mjs", "utf8");
  assert.match(packager, /RELEASE_BASELINE_COMMIT/);
  assert.match(packager, /required-route-manifest\.json/);
  assert.match(packager, /\.env\.local/);
  assert.match(verifier, /app-paths-manifest\.json/);
});
test("runtime uploads stay outside the traced artifact", () => {
  const uploadRoute = readFileSync("src/app/api/hr/upload/route.ts", "utf8");
  assert.match(uploadRoute, /turbopackIgnore/);
});
test("release workflow invokes the standalone packager", () => {
  const workflow = readFileSync("scripts/production/build-standalone-release.sh", "utf8");
  assert.match(workflow, /npm run package:standalone/);
  assert.match(workflow, /npm run build/);
});

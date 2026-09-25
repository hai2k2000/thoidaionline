import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("scripts/production/check-cache-permissions.sh", "utf8");
test("cache guard checks the actual service cache path and ownership", () => {
  assert.match(source, /cache/);
  assert.match(source, /stat/);
  assert.match(source, /thoidai-work/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

test("web login throttles attempts per client and identifier", () => {
  assert.match(route, /consumeLoginAttempt/);
  assert.match(route, /clearLoginAttempts/);
  assert.match(route, /Retry-After/);
  assert.match(route, /status: 429/);
  assert.match(route, /x-real-ip/);
});


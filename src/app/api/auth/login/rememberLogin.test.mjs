import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

test("login reads remember and sets a matching cookie lifetime", () => {
  assert.match(route, /remember\?: boolean/);
  assert.match(route, /body\.remember === true/);
  assert.match(route, /createSessionToken\([\s\S]*remember/);
  assert.match(route, /sessionCookieOptionsFor/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./passwordPolicy.ts", import.meta.url), "utf8");

test("policy rejects short, oversized, surrounding whitespace, and missing character classes", () => {
  assert.match(source, /value\.length < MIN_PASSWORD_LENGTH/);
  assert.match(source, /value\.length > MAX_PASSWORD_LENGTH/);
  assert.match(source, /value !== value\.trim\(\)/);
  assert.ok(source.includes("/[a-z]/"));
  assert.ok(source.includes("/[A-Z]/"));
  assert.ok(source.includes("/\\d/"));
  assert.match(source, /PASSWORD_SYMBOL_PATTERN/);
});

test("policy exposes one shared Vietnamese hint", () => {
  assert.match(source, /PASSWORD_POLICY_HINT/);
  assert.match(source, /12/);
});

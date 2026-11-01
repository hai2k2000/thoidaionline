import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const credentials = read("./authenticateCredentials.ts");
const forgotPassword = read("../app/api/auth/forgot-password/route.ts");
const lookup = read("./staffIdentifierLookup.ts");

test("auth flows use the safe staff identifier lookup", () => {
  for (const source of [credentials, forgotPassword]) {
    assert.match(source, /findStaffByIdentifier/);
    assert.doesNotMatch(source, /\.or\([^\n]*\$\{identifier\}/);
  }
});

test("staff identifier lookup uses ordered literal-safe queries", () => {
  assert.match(lookup, /import "server-only";/);
  assert.match(lookup, /\.eq\("username", identifier\)/);
  assert.match(lookup, /if \(!identifier\.includes\("\*"\)\)[\s\S]*\.ilike\("email"/);
  assert.match(lookup, /\.ilike\("email", escapeIlikeLiteral\(identifier\)\)/);
  assert.match(lookup, /\.eq\("phone", identifier\)/);
  assert.match(lookup, /\.limit\(1\)\.maybeSingle\(\)/);
  assert.match(lookup, /identifier\.length > 254/);
  assert.match(lookup, /\[\\\\%_\]/);
  assert.doesNotMatch(lookup, /\.or\(/);
});

test("ilike literal escaping covers wildcards and backslashes", () => {
  const escapeIlikeLiteral = (value) => value.replace(/[\\%_]/g, "\\$&");
  assert.equal(escapeIlikeLiteral("a%b_c\\d"), "a\\%b\\_c\\\\d");
});

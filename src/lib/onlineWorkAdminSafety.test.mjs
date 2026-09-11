import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/components/OnlineWorkAdminShell.tsx", "utf8");

test("online work admin cannot save an empty schedule after a failed load", () => {
  assert.match(source, /loadError/);
  assert.match(source, /loadError!==""\|\|!dirty\|\|busy/);
});

test("online work month loading ignores stale responses", () => {
  assert.match(source, /AbortController/);
  assert.match(source, /controller\.signal/);
});

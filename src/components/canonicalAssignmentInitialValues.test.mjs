import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./CanonicalAssignmentForm.tsx", import.meta.url), "utf8");

test("prefilled cards never override card defaults with undefined (e.g. recurrenceFrequency)", () => {
  assert.match(source, /Object\.fromEntries\(Object\.entries\(value\)\.filter\(\(\[, entry\]\) => entry !== undefined\)\)/);
  assert.doesNotMatch(source, /\n\s*\.\.\.value,\r?\n/);
});

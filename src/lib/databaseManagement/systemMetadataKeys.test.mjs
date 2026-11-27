import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./validation.ts", import.meta.url), "utf8");

test("server-added system keys never count as unknown form fields", () => {
  assert.match(source, /const SYSTEM_METADATA_KEYS = new Set\(\["record_code", "title", "summary", "status"\]\);/);
  assert.match(source, /if \(!knownFields\.has\(key\) && !SYSTEM_METADATA_KEYS\.has\(key\)\) errors\.push/);
});

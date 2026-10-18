import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { databaseRecordStorageKey } from "./storageKey.ts";

test("storage key is server-generated and scoped to a record", () => {
  const key = databaseRecordStorageKey("11111111-1111-4111-8111-111111111111", "../../secret.docx");
  assert.match(key, /^11111111-1111-4111-8111-111111111111[\\/][^/]+\.docx$/);
  assert.doesNotMatch(key, /\.\./);
});

test("storage implementation rejects resolved paths that escape the root", () => {
  const source = readFileSync(new URL("./storage.ts", import.meta.url), "utf8");
  assert.match(source, /realpath\(root\)/);
  assert.match(source, /resolvedParent\.startsWith/);
  assert.match(source, /resolvedTarget\.startsWith/);
});

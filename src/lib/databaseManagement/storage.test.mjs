import assert from "node:assert/strict";
import test from "node:test";
import { databaseRecordStorageKey } from "./storageKey.ts";

test("storage key is server-generated and scoped to a record", () => {
  const key = databaseRecordStorageKey("11111111-1111-4111-8111-111111111111", "../../secret.docx");
  assert.match(key, /^11111111-1111-4111-8111-111111111111[\\/][^/]+\.docx$/);
  assert.doesNotMatch(key, /\.\./);
});

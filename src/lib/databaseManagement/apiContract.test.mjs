import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const route = read("../../app/api/database/records/route.ts");
const repository = read("./repository.ts");

test("database record API is server-session guarded and no-store", () => {
  assert.match(route, /getSessionUser/);
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /private, no-store/);
  assert.match(route, /validateDatabaseRecordInput/);
});

test("record list applies ACL before returning rows and create requires record.create", () => {
  assert.match(repository, /canAccessDatabaseRecord/);
  assert.match(repository, /defaultDatabaseRecordAccess/);
  assert.match(repository, /record\.create/);
  assert.match(route, /logServerAudit/);
  assert.match(repository, /record_scope_forbidden/);
  assert.match(repository, /cleanupNewRecord/);
});

test("record API accepts language filtering and persists the selected language", () => {
  assert.match(route, /languageCode: params\.get\("languageCode"\)/);
  assert.match(repository, /language_code: languageCodeForCategory\(category\.code\) \?\? languageCode/);
  assert.match(repository, /row\.language_code \?\? languageByCategory\.get\(row\.category_id\) \?\? null/);
});

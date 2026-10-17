import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const detail = read("src/app/api/database/records/[id]/route.ts");
const files = read("src/app/api/database/records/[id]/files/route.ts");
const download = read("src/app/api/database/records/[id]/files/[fileId]/route.ts");
const repository = read("src/lib/databaseManagement/repository.ts");
const acl = read("src/app/api/database/records/[id]/acl/route.ts");
const restore = read("src/app/api/database/records/[id]/restore/route.ts");

test("record lifecycle routes enforce session, origin and server authorization", () => {
  for (const source of [detail, files, acl, restore]) {
    assert.match(source, /getSessionUser/);
    assert.match(source, /isSameOriginRequest/);
  }
  assert.match(detail, /setDatabaseRecordStatus/);
  assert.match(detail, /updateDatabaseRecord/);
  assert.match(acl, /validateDatabaseAclInput/);
});

test("private file routes use server storage and verify integrity", () => {
  assert.match(files, /writeDatabaseRecordFile/);
  assert.match(files, /removeDatabaseRecordFile/);
  assert.match(download, /readDatabaseRecordFile/);
  assert.match(download, /file_integrity_failed/);
  assert.match(repository, /canRecord\(actor, current, recordId, "download"\)/);
  assert.match(repository, /historyError/);
  assert.match(repository, /previous/);
  assert.match(repository, /expires_at: input.expiresAt/);
});

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
const exportRoute = read("src/app/api/database/records/[id]/export/route.ts");
const auditOutbox = read("src/lib/databaseManagement/auditOutbox.ts");

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
  assert.match(files, /MAX_MULTIPART_BYTES/);
  assert.match(files, /boundedBody/);
  assert.match(files, /file_too_large/);
  assert.match(files, /invalid_content_length/);
  assert.match(files, /invalid_multipart/);
  assert.match(files, /file_upload/);
  assert.match(files, /file_upload_reconciliation_required/);
  assert.match(files, /action: "upload"/);
  assert.match(download, /logServerAudit/);
  assert.match(exportRoute, /logServerAudit/);
  assert.match(download, /audit_unavailable/);
  assert.match(exportRoute, /audit_unavailable/);
  assert.match(restore, /action: "restore"/);
  assert.match(restore, /audit_status/);
  assert.match(auditOutbox, /enqueueAndDeliverAudit/);
});

test("metadata export is authenticated and capability-gated", () => {
  assert.match(exportRoute, /getSessionUser/);
  assert.match(exportRoute, /canAccessDatabaseRecordForActor[\s\S]*[\"']export[\"']/);
  assert.match(exportRoute, /Content-Disposition/);
});

test("create and update return field-level metadata errors", () => {
  assert.match(read("src/app/api/database/records/route.ts"), /JSON\.parse\(error\.message\.slice\("invalid_metadata:"\.length\)\)/);
  assert.match(detail, /JSON\.parse\(message\.slice\("invalid_metadata:"\.length\)\)/);
});

test("record create and upload routes expose idempotency reconciliation contracts", () => {
  const createRoute = read("src/app/api/database/records/route.ts");
  const createPost = createRoute.slice(createRoute.indexOf("export async function POST"));
  assert.match(createRoute, /Idempotency-Key/);
  assert.match(createPost, /const clientRequestId = request\.headers\.get\("Idempotency-Key"\)\?\.trim\(\) \?\? ""/);
  assert.match(createPost, /createDatabaseRecord\(actor, validated\.value, clientRequestId \|\| undefined\)/);
  assert.match(read("src/app/api/database/records/[id]/files/route.ts"), /Idempotency-Key/);
  assert.match(read("src/app/api/database/records/[id]/files/route.ts"), /upload_request_id/);
});

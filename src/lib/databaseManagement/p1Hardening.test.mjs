import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const repository = read("src/lib/databaseManagement/repository.ts");
const uploadRoute = read("src/app/api/database/records/[id]/files/route.ts");
const recordRoute = read("src/app/api/database/records/[id]/route.ts");
const workflowRoute = read("src/app/api/database/records/[id]/workflow/route.ts");
const detailPage = read("src/app/database/records/[id]/page.tsx");

test("repository enforces download and metadata decisions", () => {
  assert.match(repository, /getDatabaseRecordFile[\s\S]*decideDatabaseRecordDownload/);
  assert.match(repository, /databaseRecordMetadataDenied/);
  assert.match(repository, /canDownload/);
  assert.match(repository, /canEdit/);
  assert.match(repository, /old_data: metadataAllowed \? item\.old_data : null/);
  assert.match(repository, /new_data: metadataAllowed \? item\.new_data : null/);
});

test("repository locks and reopens records with status guards", () => {
  assert.match(repository, /current\.status === "pending_review"\) throw new Error\("record_locked"\)/);
  assert.match(repository, /action: "reopen_for_edit"/);
  assert.match(repository, /\.eq\("status", current\.status\)/);
  assert.doesNotMatch(repository, /update\(\{ \.\.\.current \}\)/);
});

test("upload and PATCH routes map record_locked", () => {
  assert.match(uploadRoute, /prepareDatabaseRecordFileUpload/);
  assert.match(uploadRoute, /record_locked.*409|409.*record_locked/);
  assert.match(recordRoute, /record_locked.*409|409.*record_locked/);
});

test("workflow audit does not use a fixed record workflow key", () => {
  assert.doesNotMatch(workflowRoute, /record-workflow:/);
});

test("detail page exposes hardened edit/download UI", () => {
  assert.match(detailPage, /detail\.canEdit/);
  assert.match(detailPage, /detail\.canDownload/);
  assert.match(detailPage, /reopen_for_edit/);
  assert.match(detailPage, /Hồ sơ đã duyệt sẽ chuyển về Nháp/);
});

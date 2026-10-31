import assert from "node:assert/strict";
import test from "node:test";
import { databaseRecordFileType, hasDatabaseRecordFileMagic } from "./fileType.mjs";

test("infers allowlisted database record MIME types from extension", () => {
  assert.equal(databaseRecordFileType("file.PDF"), "application/pdf");
  assert.equal(databaseRecordFileType("sheet.xlsx"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(databaseRecordFileType("payload.exe"), null);
});

test("validates minimum file signatures", () => {
  assert.equal(hasDatabaseRecordFileMagic("a.pdf", new TextEncoder().encode("%PDF-1.7")), true);
  assert.equal(hasDatabaseRecordFileMagic("a.pdf", new TextEncoder().encode("not-pdf")), false);
  assert.equal(hasDatabaseRecordFileMagic("a.docx", Uint8Array.from([0x50, 0x4b, 0x03, 0x04])), true);
  assert.equal(hasDatabaseRecordFileMagic("a.xls", Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])), true);
  assert.equal(hasDatabaseRecordFileMagic("a.xlsx", Uint8Array.from([0x50, 0x4b, 0x05, 0x06])), false);
});
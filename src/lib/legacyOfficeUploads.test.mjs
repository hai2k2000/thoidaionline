import assert from 'node:assert/strict';
import test from 'node:test';
import { taskAttachmentMetadata, readTaskAttachmentMetadata, validateTaskAttachment, TASK_ATTACHMENT_ACCEPT, TASK_ATTACHMENT_FORMAT_MESSAGE } from './taskAttachmentPolicy.mjs';
import { filePreviewKind } from './filePreview.mjs';
import { validateSelectedFiles } from './databaseManagement/uploadClient.mjs';
import { databaseRecordFileType, hasDatabaseRecordFileMagic, DATABASE_RECORD_FILE_ACCEPT, DATABASE_RECORD_FORMAT_MESSAGE } from './databaseManagement/fileType.mjs';
import { libraryOfficeKind } from './projectLibraryFile.ts';
import { readFileSync } from 'node:fs';

const ole = Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
for (const [extension, mime] of [['doc', 'application/msword'], ['xls', 'application/vnd.ms-excel']]) {
  test(`attachment policy accepts synthetic ${extension} with OLE2 and canonicalizes browser MIME`, () => {
    for (const type of ['', 'application/octet-stream', 'application/x-msword']) {
      const file = new File([ole, new Uint8Array(51 * 1024 - ole.length)], `test.${extension}`, { type });
      assert.deepEqual(taskAttachmentMetadata(file, ole), { extension, mimeType: mime });
      for (const bytes of [new Uint8Array(), ole.slice(0, 4), Uint8Array.from([0x50, 0x4b, 3, 4]), Uint8Array.from([0x4d, 0x5a])]) {
        assert.equal(taskAttachmentMetadata(file, bytes), null);
      }
    }
  });
  test(`CSDL client accepts ${extension} with odd MIME and rejects renamed content`, async () => {
    for (const type of ['', 'application/octet-stream', 'application/x-msword']) {
      const file = new File([ole], `test.${extension}`, { type });
      assert.deepEqual(await validateSelectedFiles([file]), []);
      assert.equal(await validateTaskAttachment(file), null);
      assert.deepEqual(await readTaskAttachmentMetadata(file), { extension, mimeType: mime });
      assert.equal(databaseRecordFileType(file.name), mime);
      assert.equal(hasDatabaseRecordFileMagic(file.name, ole), true);
    }
    assert.equal(hasDatabaseRecordFileMagic(`test.${extension}`, new TextEncoder().encode('PK\x03\x04')), false);
    assert.equal((await validateSelectedFiles([new File(['MZ'], `test.${extension}`, { type: mime })])).length, 1);
  });
}
test('unsupported and macro extensions cannot bypass the extension allowlist with an allowed MIME', () => {
  for (const extension of ['exe', 'docm', 'xlsm', 'pptm', 'ppt', 'pptx']) {
    assert.equal(taskAttachmentMetadata(new File([ole], `test.${extension}`, { type: 'application/pdf' }), ole), null);
  }
});
test('legacy Office always downloads even with misleading modern Office MIME', () => {
  for (const extension of ['doc', 'xls', 'ppt']) {
    assert.equal(filePreviewKind({ fileName: `test.${extension}`, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), null);
    assert.equal(libraryOfficeKind({ file_name: `test.${extension}`, title: 'fixture', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), null);
  }
});

test('all document pickers and format errors use their shared allowlist', async () => {
  for (const [accept, message, size] of [[TASK_ATTACHMENT_ACCEPT, TASK_ATTACHMENT_FORMAT_MESSAGE, 10], [DATABASE_RECORD_FILE_ACCEPT, DATABASE_RECORD_FORMAT_MESSAGE, 150]]) {
    for (const extension of accept.split(',')) assert.ok(message.includes(extension.slice(1).toUpperCase()));
    for (const extension of ['.doc', '.xls']) assert.ok(accept.split(',').includes(extension));
    for (const extension of ['.docm', '.xlsm', '.pptm', '.exe', '.ppt', '.pptx']) assert.ok(!accept.split(',').includes(extension));
    assert.ok(message.includes(`${size} MB`));
  }
  for (const path of ['TaskAttachmentUploader', 'QuickReportForm', 'TaskAssignShell', 'CanonicalAssignmentForm', 'ProjectLibrary', 'SharedLibraryShell', 'DutyReviewCard']) {
    assert.match(readFileSync(`src/components/${path}.tsx`, 'utf8'), /accept=\{TASK_ATTACHMENT_ACCEPT\}/);
  }
  assert.match(readFileSync('src/app/hr-profiles/[id]/page.tsx', 'utf8'), /accept=\{TASK_ATTACHMENT_ACCEPT\}/);
  for (const path of ['src/components/DatabaseRecordForm.tsx', 'src/app/database/records/[id]/page.tsx']) assert.match(readFileSync(path, 'utf8'), /accept=\{DATABASE_RECORD_FILE_ACCEPT\}/);
  assert.equal(await validateTaskAttachment(new File(['MZ'], 'bad.doc')), TASK_ATTACHMENT_FORMAT_MESSAGE);
  for (const extension of ['docm', 'xlsm', 'pptm', 'exe', 'ppt']) {
    assert.equal(databaseRecordFileType(`bad.${extension}`), null);
    assert.equal(hasDatabaseRecordFileMagic(`bad.${extension}`, ole), false);
    assert.deepEqual(await validateSelectedFiles([new File([ole], `bad.${extension}`, { type: 'application/msword' })]), [{ index: 0, code: 'invalid_type' }]);
  }
});

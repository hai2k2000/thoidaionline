import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as policy from './taskAttachmentPolicy.mjs';
import * as legacy from './legacyOffice.mjs';
import { contentDisposition } from './contentDisposition.mjs';
import * as databaseFileTypes from './databaseManagement/fileType.mjs';

const require = createRequire(import.meta.url);
const id = '11111111-1111-4111-8111-111111111111';
const actor = { id, role_code: 'admin', permissions: { can_edit_all_tasks: true } };
const ole = Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
function harness(path) {
  const writes = [], registrations = [];
  const json = (body, status = 200) => Response.json(body, { status });
  const storage = { upload: async (...args) => { writes.push(args); return { error: null }; }, remove: async () => {} };
  const query = { select() { return this; }, eq() { return this; }, insert(data) { registrations.push(data); return this; }, single: async () => ({ data: { id }, error: null }), maybeSingle: async () => ({ data: { id } }), upsert: async data => { registrations.push(data); return { error: null }; } };
  const deps = {
    '@/lib/taskAttachmentPolicy.mjs': policy, '@/lib/legacyOffice.mjs': legacy,
    '@/lib/contentDisposition.mjs': { contentDisposition },
    '@/lib/databaseManagement/fileType.mjs': databaseFileTypes,
    '@/lib/databaseManagement/repository': { canAccessDatabaseRecordForActor: async () => true, assertCanModifyRecordFiles: async () => ({ status: 'draft' }), reopenRecordAfterFileChange: async () => {} },
    '@/lib/databaseManagement/storage': { writeDatabaseRecordFile: async (_id, input) => { writes.push(input); return { storageKey: 'fixture', created: true, sizeBytes: input.bytes.length, sha256: 'fixture' }; } },
    '@/lib/serverAudit': { logServerAudit: async () => 'delivered' },
    '@/lib/serverApi': { apiJson: json, apiError: (code, status) => json({ error: { code } }, status), asUuid: v => v === id ? id : null,
      requireMutationActor: async () => ({ ok: true, actor }), requireReadActor: async () => ({ ok: true, actor }), readJsonObject: r => r.json(), rpcFailure: () => json({}, 403) },
    '@/lib/serverSession': { getSessionUser: async () => actor, isSameOriginRequest: async () => true },
    '@/lib/collaboratorRole.mjs': { isCollaboratorRole: () => false },
    '@/lib/rbac/authorization': { hasPermission: () => true }, '@/lib/rbac/repository': { loadRbacActor: async () => actor },
    '@/lib/announcementLibrary.mjs': { isSafeLibraryUrl: () => true },
    '@/lib/serverSupabase': { serverSupabase: { storage: { from: () => storage }, from: () => query } },
    '@/lib/projectRepository': { projectRepository: { listMembers: async () => ({ ok: true, data: [] }) } },
    '@/lib/projectLibraryRepository': { projectLibraryRepository: { addItem: async (_actor, _project, input) => { registrations.push(input); return { ok: true, data: { id } }; } } },
    '@/lib/sharedLibraryRepository': { sharedLibraryRepository: { addItem: async (_actor, input) => { registrations.push(input); return { data: { id } }; } } },
    'fs/promises': { mkdir: async () => {}, writeFile: async (...args) => { writes.push(args); } },
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
  };
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const routeModule = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => deps[name] ?? require(name), routeModule, routeModule.exports);
  return { route: routeModule.exports, writes, registrations };
}
for (const [name, path, field, success] of [
  ['project library', 'src/app/api/projects/[id]/library/route.ts', 'file', 201],
  ['shared library', 'src/app/api/shared-library/route.ts', 'file', 201],
  ['duty review', 'src/app/api/tasks/duty/review/route.ts', 'evidence', 200],
  ['HR', 'src/app/api/hr/upload/route.ts', 'file', 200],
  ['CSDL', 'src/app/api/database/records/[id]/files/route.ts', 'file', 201],
]) {
  test(`${name}: synthetic legacy files use canonical MIME; invalid/macro/slide files never reach storage`, async () => {
    for (const [extension, mime] of [['doc', 'application/msword'], ['xls', 'application/vnd.ms-excel']]) {
      for (const browserMime of ['', 'application/octet-stream', 'application/x-msword']) {
        const { route, writes, registrations } = harness(path);
        const form = new FormData();
        form.set(field, new File([ole], `fixture.${extension}`, { type: browserMime }));
        for (const key of ['folderId', 'userId', 'taskId']) form.set(key, id);
        form.set('result', 'completed'); form.set('onTime', 'true');
        const response = await route.POST(new Request('http://localhost', { method: 'POST', body: form }), { params: Promise.resolve({ id }) });
        assert.equal(response.status, success, name);
        assert.equal(writes.length, 1);
        if (name === 'HR') assert.ok(writes[0][0].endsWith(`.${extension}`));
        else if (name === 'CSDL') {
          assert.equal(writes[0].mimeType, mime);
          assert.equal(registrations[0].mime_type, mime);
        } else {
          assert.equal(writes[0][2].contentType, mime);
          assert.equal(registrations[0].mimeType ?? registrations[0].evidence_mime, mime);
        }
      }
    }
    for (const [extension, bytes] of [['doc', 'MZ'], ['xls', 'PK\x03\x04'], ['doc', ole.slice(0, 4)], ['docm', ole], ['xlsm', ole], ['pptm', ole], ['exe', ole], ['ppt', ole], ['pptx', ole]]) {
      const { route, writes } = harness(path);
      const form = new FormData(); form.set(field, new File([bytes], `fixture.${extension}`, { type: 'application/pdf' }));
      for (const key of ['folderId', 'userId', 'taskId']) form.set(key, id);
      form.set('result', 'completed'); form.set('onTime', 'true');
      const response = await route.POST(new Request('http://localhost', { method: 'POST', body: form }), { params: Promise.resolve({ id }) });
      assert.equal(response.status, name === 'CSDL' ? 415 : 400);
      const payload = await response.json();
      assert.equal(payload.message ?? (typeof payload.error === 'string' ? payload.error : payload.error.message), name === 'CSDL' ? databaseFileTypes.DATABASE_RECORD_FORMAT_MESSAGE : policy.TASK_ATTACHMENT_FORMAT_MESSAGE);
      assert.equal(writes.length, 0);
    }
  });
}

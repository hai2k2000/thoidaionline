import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import ts from 'typescript';
import * as helpers from './mobileApk.mjs';

function route(kind, actor, overrides = {}) {
  let reads = 0;
  const source = readFileSync(`src/app/api/mobile/apk/${kind}/route.ts`, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const manifest = { version: '1.0.0', versionCode: 2, fileName: 'work.apk', size: 3, sha256: 'a'.repeat(64), publishedAt: '2026-11-05T00:00:00Z' };
  const dependencies = {
    'node:stream': { Readable },
    '@/lib/serverApi': { requireReadActor: async () => actor ? { ok: true, actor } : { ok: false, response: Response.json({ error: 'unauthenticated' }, { status: 401 }) } },
    '@/lib/mobileApk.mjs': { ...helpers, readApkManifest: async () => { reads++; return manifest; }, openApkFile: async () => ({ createReadStream: () => Readable.from([Buffer.from('apk')]) }), ...overrides },
  };
  const result = {};
  new Function('require', 'exports', compiled)((name) => dependencies[name], result);
  return { get: result.GET, reads: () => reads, manifest };
}
for (const kind of ['latest', 'download']) {
  test(`${kind}: unauthenticated requests never read distribution files`, async () => {
    const r = route(kind, null); assert.equal((await r.get()).status, 401); assert.equal(r.reads(), 0);
  });
  test(`${kind}: collaborators receive private no-store response`, async () => {
    const r = route(kind, { role_code: 'cong_tac_vien' }); const response = await r.get();
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
    if (kind === 'latest') assert.deepEqual(await response.json(), r.manifest);
    else { assert.equal(await response.text(), 'apk'); assert.equal(response.headers.get('content-type'), 'application/vnd.android.package-archive'); assert.equal(response.headers.get('content-disposition'), 'attachment; filename="work.apk"'); }
  });
  test(`${kind}: missing files return Vietnamese 404 without a filesystem path`, async () => {
    const r = route(kind, {}, { readApkManifest: async () => { throw Object.assign(Error('/private/path'), { code: 'ENOENT' }); } });
    const response = await r.get(); assert.equal(response.status, 404); assert.deepEqual(await response.json(), { error: helpers.MOBILE_APK_NOT_FOUND });
  });
  test(`${kind}: malformed publication fails closed`, async () => {
    const r = route(kind, {}, { readApkManifest: async () => { throw Error('Invalid APK manifest'); } });
    assert.equal((await r.get()).status, 503);
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GET } from '../app/api/version/route.ts';
import { isCollaboratorAllowedPath } from './collaboratorRole.mjs';
test('version route is no-store and exposes only build', async () => {
  const response = await GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const body = await response.json();
  assert.deepEqual(Object.keys(body), ['build']);
  assert.equal(typeof body.build, 'string');
  assert.ok(body.build.length > 0);
});
test('public version path is narrow and CTV GET only', () => {
  const proxy = readFileSync('src/proxy.ts', 'utf8');
  assert.match(proxy, /pathname === "\/api\/version"/);
  assert.equal(isCollaboratorAllowedPath('/api/version', 'GET'), true);
  assert.equal(isCollaboratorAllowedPath('/api/version', 'POST'), false);
  assert.equal(isCollaboratorAllowedPath('/api/version/private', 'GET'), false);
});

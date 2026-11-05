import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function worker() {
  const listeners = {}; const stores = new Map(); const fetched = []; let offline = false;
  const cache = { addAll: async (assets) => assets.forEach((url) => stores.set(url, `public:${url}`)), match: async (url) => stores.get(url) };
  const deleted = [];
  vm.runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    URL, self: { location: { origin: 'https://thoidai.online' }, addEventListener: (name, fn) => listeners[name] = fn, skipWaiting: async () => {}, clients: { claim: async () => {} } },
    caches: { open: async () => cache, keys: async () => ['thoidai-offline-v0', 'unrelated-cache', 'thoidai-offline-v1', 'thoidai-offline-v2'], delete: async (key) => deleted.push(key) },
    fetch: async (request) => { fetched.push(request.url); if (offline) throw Error('offline'); return 'private-html'; },
  });
  const lifecycle = async (name) => { let task; listeners[name]({ waitUntil: (p) => task = p }); await task; };
  const request = async (path, mode = 'navigate', method = 'GET') => { let result; listeners.fetch({ request: { url: `https://thoidai.online${path}`, mode, method }, respondWith: (p) => result = p }); return result; };
  return { lifecycle, request, stores, deleted, fetched, goOffline: () => offline = true };
}

test('precache is limited to offline page and icons, old owned caches are removed', async () => {
  const w = worker(); await w.lifecycle('install'); await w.lifecycle('activate');
  assert.equal(w.stores.size, 5);
  for (const path of w.stores.keys()) assert.ok(path === '/offline.html' || path.startsWith('/icons/'));
  assert.deepEqual(w.deleted, ['thoidai-offline-v0', 'thoidai-offline-v1']);
});
test('navigation is network-first and never stores authenticated HTML', async () => {
  const w = worker(); await w.lifecycle('install');
  assert.equal(await w.request('/account'), 'private-html');
  assert.equal(w.stores.has('/account'), false);
  w.goOffline(); assert.equal(await w.request('/account'), 'public:/offline.html');
  assert.equal(w.stores.size, 5);
});
test('API, uploads and mutations are never intercepted, even as navigation', async () => {
  const w = worker(); await w.lifecycle('install'); w.goOffline();
  for (const path of ['/api', '/api/mobile/apk/download', '/api/auth/session', '/uploads/private.pdf']) assert.equal(await w.request(path), undefined);
  assert.equal(await w.request('/account', 'navigate', 'POST'), undefined);
  assert.equal(await w.request('/account', 'cors'), undefined);
});

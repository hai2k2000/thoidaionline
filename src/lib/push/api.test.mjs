import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { parseWebPushSubscription } from './subscription.mjs';
function route(path, authorized = true) {
  const calls = [];
  const query = { upsert: (...args) => { calls.push(['upsert', ...args]); return query; }, delete: () => { calls.push(['delete']); return query; }, eq: (...args) => { calls.push(['eq', ...args]); return query; }, then: resolve => resolve({ error: null }) };
  const guard = async () => authorized ? { ok: true, actor: { id: 'actor' } } : { ok: false, response: new Response(null, { status: 401 }) };
  const deps = {
    '@/lib/serverApi': { requireReadActor: guard, requireMutationActor: guard, readJsonObject: request => request.json(), apiJson: value => Response.json(value), apiError: (code, status) => Response.json({ code }, { status }) },
    '@/lib/serverSupabase': { serverSupabase: { from: table => { calls.push(['from', table]); return query; } } },
    '@/lib/push/subscription.mjs': { parseWebPushSubscription },
  };
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {}; new Function('require', 'exports', compiled)(name => deps[name], exports);
  return { exports, calls };
}
const paths = ['src/app/api/push/config/route.ts', 'src/app/api/push/subscribe/route.ts', 'src/app/api/push/unsubscribe/route.ts', 'src/app/api/mobile/push-token/route.ts'];
const request = (body, method = 'POST') => new Request('https://thoidai.online/api/push/subscribe', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
test('every push route requires login before any database access', async () => {
  for (const path of paths) {
    const r = route(path, false);
    for (const handler of Object.values(r.exports).filter(value => typeof value === 'function')) assert.equal((await handler(request({}))).status, 401);
    assert.deepEqual(r.calls, []);
  }
});
test('webpush registration ignores caller-supplied user and stores only validated fields', async () => {
  const r = route(paths[1]);
  const body = { user_id: 'someone-else', endpoint: 'https://fcm.googleapis.com/fcm/send/test', keys: { p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64)]).toString('base64url'), auth: Buffer.alloc(16).toString('base64url') } };
  assert.equal((await r.exports.POST(request(body))).status, 200);
  assert.equal(r.calls.find(call => call[0] === 'upsert')[1].user_id, 'actor');
  assert.equal((await r.exports.POST(request({ ...body, endpoint: 'https://127.0.0.1/private' }))).status, 400);
});
test('unsubscribe and Android token removal are scoped to actor and device kind', async () => {
  for (const [path, method, body, kind] of [[paths[2], 'POST', { endpoint: 'https://push.test' }, 'webpush'], [paths[3], 'DELETE', { token: 'test-token' }, 'fcm']]) {
    const r = route(path); assert.equal((await r.exports[method](request(body, method))).status, 200);
    assert.ok(r.calls.some(call => call[0] === 'eq' && call[1] === 'user_id' && call[2] === 'actor'));
    assert.ok(r.calls.some(call => call[0] === 'eq' && call[1] === 'kind' && call[2] === kind));
  }
});
test('Android registrations use unified table and require Android platform', async () => {
  const r = route(paths[3]);
  assert.equal((await r.exports.POST(request({ token: 'test-token', platform: 'android', user_id: 'other' }))).status, 200);
  assert.equal(r.calls[0][1], 'push_subscriptions');
  const row = r.calls.find(call => call[0] === 'upsert')[1]; assert.equal(row.user_id, 'actor'); assert.equal(row.kind, 'fcm');
  assert.equal((await r.exports.POST(request({ token: 'token', platform: 'other' }))).status, 400);
});

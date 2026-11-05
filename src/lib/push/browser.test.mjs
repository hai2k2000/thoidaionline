import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function load() {
  const calls = []; let completeRegistration;
  const subscription = { endpoint: 'https://push.test/endpoint', toJSON: () => ({ endpoint: 'https://push.test/endpoint' }), unsubscribe: async () => calls.push('browser-unsubscribe') };
  const navigator = { userAgent: 'Browser', serviceWorker: { getRegistration: async () => ({ pushManager: { getSubscription: async () => subscription } }) } };
  const fetch = async url => { calls.push(url); if (url.endsWith('/subscribe')) await new Promise(resolve => completeRegistration = resolve); return { ok: true }; };
  const exports = {}; const source = ts.transpileModule(readFileSync('src/lib/push/browser.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('exports','navigator','fetch','AbortSignal',source)(exports,navigator,fetch,AbortSignal);
  return { exports, calls, subscription, complete: () => completeRegistration() };
}
test('browser logout waits for pending subscription then revokes and blocks late registration', async () => {
  const f = load(); f.exports.beginBrowserPushSession('u1');
  const registering = f.exports.registerBrowserSubscription(f.subscription, 'u1');
  const stopping = f.exports.stopBrowserPush();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.calls, ['/api/push/subscribe']);
  f.complete(); await registering; await stopping;
  assert.deepEqual(f.calls, ['/api/push/subscribe','/api/push/unsubscribe','browser-unsubscribe']);
  await assert.rejects(f.exports.registerBrowserSubscription(f.subscription, 'u1'));
});

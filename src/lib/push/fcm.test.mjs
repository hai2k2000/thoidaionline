import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, verify } from 'node:crypto';
import { createServiceAccountJwt, createFcmSender } from './fcm.mjs';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const account = { client_email: 'test@example.invalid', project_id: 'test-project', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
test('FCM assertion is RS256 signed with fixed OAuth audience, scope and one hour expiry', () => {
  const jwt = createServiceAccountJwt(account, 1000);
  const [header, payload, signature] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), { alg: 'RS256', typ: 'JWT' });
  assert.deepEqual(JSON.parse(Buffer.from(payload, 'base64url')), { iss: account.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: 1000, exp: 4600 });
  assert.ok(verify('RSA-SHA256', Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, 'base64url')));
});
test('FCM reuses OAuth token and classifies UNREGISTERED from v1 response', async () => {
  const calls = [];
  const send = createFcmSender(account, { fetchImpl: async (url, init) => {
    calls.push([url, init]);
    return url.includes('oauth2') ? { ok: true, json: async () => ({ access_token: 'fake', expires_in: 3600 }) }
      : { ok: false, json: async () => ({ error: { details: [{ errorCode: 'UNREGISTERED' }] } }) };
  } });
  for (let i = 0; i < 2; i++) await assert.rejects(send({ token: 'device' }, { title: 'Title', body: 'Body', url: '/tasks/t1', tag: 'n1' }), { code: 'UNREGISTERED' });
  assert.equal(calls.filter(([url]) => url.includes('oauth2')).length, 1);
  assert.equal(JSON.parse(calls[1][1].body).message.data.url, '/tasks/t1');
});

test('concurrent FCM sends share one in-flight OAuth request', async () => {
  let oauth = 0;
  const send = createFcmSender(account, { fetchImpl: async url => {
    if (url.includes('oauth2')) {
      oauth++;
      await new Promise(resolve => setImmediate(resolve));
      return { ok: true, json: async () => ({ access_token: 'fake', expires_in: 3600 }) };
    }
    return { ok: true };
  } });
  await Promise.all(Array.from({ length: 10 }, () => send({ endpoint: 'device' }, { title: 'Title', body: 'Body', url: '/tasks/t1', tag: 'n1' })));
  assert.equal(oauth, 1);
});

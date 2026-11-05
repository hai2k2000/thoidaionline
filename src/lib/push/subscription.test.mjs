import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWebPushSubscription } from './subscription.mjs';
const valid = { endpoint: 'https://fcm.googleapis.com/fcm/send/test', keys: { p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64)]).toString('base64url'), auth: Buffer.alloc(16).toString('base64url') } };
test('webpush registration validates public provider endpoint and encryption key lengths', () => {
  assert.equal(parseWebPushSubscription(valid)?.endpoint, valid.endpoint);
  for (const endpoint of ['http://fcm.googleapis.com/x', 'https://127.0.0.1/x', 'https://internal.example/x', 'https://fcm.googleapis.com.evil.test/x', 'https://user:pass@fcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x']) assert.equal(parseWebPushSubscription({ ...valid, endpoint }), null);
  assert.equal(parseWebPushSubscription({ ...valid, keys: { p256dh: 'bad', auth: 'bad' } }), null);
});

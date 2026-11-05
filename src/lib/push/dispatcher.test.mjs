import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchOnce, notificationPayload } from './dispatcher.mjs';

const notification = { id: 'n1', user_id: 'u1', message: 'Your task', href: '/tasks/t1', push_attempts: 1, push_claim_token: 'claim1' };
function fixture(subscriptions, senders) {
  const calls = [];
  const repository = {
    claim: async kinds => { calls.push(['claim', kinds]); return [notification]; },
    subscriptions: async userId => { calls.push(['subscriptions', userId]); return subscriptions; },
    subscriptionFailed: async (id, disable) => calls.push(['failed', id, disable]),
    complete: async row => calls.push(['complete', row.id, row.push_claim_token]),
    release: async row => calls.push(['release', row.id, row.push_claim_token]),
  };
  return { calls, run: () => dispatchOnce({ repository, senders, logger: { warn() {} } }) };
}
test('claims once and sends only to every active recipient subscription', async () => {
  const sent = [];
  const f = fixture([{ id: 's1', kind: 'webpush' }, { id: 's2', kind: 'fcm' }, { id: 's3', kind: 'webpush', disabled_at: 'yesterday' }], {
    webpush: async (sub, payload) => sent.push([sub.id, payload]), fcm: async (sub, payload) => sent.push([sub.id, payload]),
  });
  await f.run();
  assert.deepEqual(sent.map(([id]) => id), ['s1', 's2']);
  assert.deepEqual(f.calls[0], ['claim', ['webpush', 'fcm']]);
  assert.deepEqual(f.calls.at(-1), ['complete', 'n1', 'claim1']);
  assert.deepEqual(sent[0][1], { title: 'Thời Đại Work', body: 'Your task', url: '/tasks/t1', tag: 'n1' });
});
test('expired webpush and unregistered FCM endpoints are disabled, not retried', async () => {
  const f = fixture([{ id: 'gone', kind: 'webpush' }, { id: 'bad', kind: 'fcm' }], {
    webpush: async () => { throw { statusCode: 410 }; }, fcm: async () => { throw { code: 'UNREGISTERED' }; },
  });
  await f.run();
  assert.ok(f.calls.some(c => c[0] === 'failed' && c[1] === 'gone' && c[2]));
  assert.ok(f.calls.some(c => c[0] === 'failed' && c[1] === 'bad' && c[2]));
  assert.equal(f.calls.at(-1)[0], 'complete');
});
test('transient send failure releases the lease and is not marked sent', async () => {
  const f = fixture([{ id: 's1', kind: 'webpush' }], { webpush: async () => { throw { statusCode: 503 }; } });
  await f.run();
  assert.deepEqual(f.calls.at(-2), ['failed', 's1', false]);
  assert.equal(f.calls.at(-1)[0], 'release');
});
test('disabled channels do not claim or consume retry attempts', async () => {
  const f = fixture([], {}); await f.run(); assert.deepEqual(f.calls, []);
});
test('payload only contains bounded notification fields and safe local task/project URLs', () => {
  assert.equal(notificationPayload({ ...notification, href: 'https://evil.example', secret: 'private' }).url, '/my-tasks');
  assert.equal(notificationPayload({ ...notification, href: '//evil.example' }).url, '/my-tasks');
  assert.equal(notificationPayload({ ...notification, href: '/projects/project1' }).url, '/projects/project1');
  assert.equal(notificationPayload({ ...notification, message: 'x'.repeat(2000) }).body.length, 500);
});

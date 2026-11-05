import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchOnce, notificationPayload } from './dispatcher.mjs';

const notification = { id: 'n1', user_id: 'u1', title: 'Công việc mới được giao', message: 'Your task', href: '/tasks/t1', push_attempts: 1, push_claim_token: 'claim1' };
function fixture(subscriptions, senders) {
  const calls = [];
  const deliveries = new Map();
  const repository = {
    deliveries: async () => [...deliveries.values()],
    recordDelivery: async (notificationId, subscriptionId, previous, { delivered, errorCode }) => deliveries.set(subscriptionId, { subscription_id: subscriptionId, delivered_at: delivered ? 'now' : null, attempts: (previous?.attempts ?? 0) + 1, last_error_code: errorCode }),
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
  assert.deepEqual(sent[0][1], { title: 'Công việc mới được giao', body: 'Your task', url: '/tasks/t1', tag: 'n1' });
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

test('partial failure retries only the failed device', async () => {
  const sent = []; let attempt = 0;
  const f = fixture([{ id: 'ok', kind: 'webpush' }, { id: 'retry', kind: 'webpush' }], {
    webpush: async sub => { sent.push(sub.id); if (sub.id === 'retry' && attempt++ === 0) throw { statusCode: 503 }; },
  });
  await f.run(); await f.run();
  assert.deepEqual(sent, ['ok', 'retry', 'retry']);
  assert.equal(f.calls.at(-1)[0], 'complete');
});

test('an unconfigured active channel keeps a partially delivered notification pending', async () => {
  const f = fixture([{ id: 'ok', kind: 'webpush' }, { id: 'later', kind: 'fcm' }], { webpush: async () => {} });
  await f.run();
  assert.equal(f.calls.at(-1)[0], 'release');
});

test('five transient failures exhaust only that device and never resend delivered devices', async () => {
  const attempts = { ok: 0, failing: 0 };
  const f = fixture([{ id: 'ok', kind: 'webpush' }, { id: 'failing', kind: 'webpush' }], {
    webpush: async sub => { attempts[sub.id]++; if (sub.id === 'failing') throw { statusCode: 503 }; },
  });
  for (let i = 0; i < 6; i++) await f.run();
  assert.deepEqual(attempts, { ok: 1, failing: 5 });
  assert.equal(f.calls.at(-1)[0], 'complete');
});
test('payload only contains bounded notification fields and safe local task/project URLs', () => {
  assert.equal(notificationPayload({ ...notification, href: 'https://evil.example', secret: 'private' }).url, '/my-tasks');
  assert.equal(notificationPayload({ ...notification, href: '//evil.example' }).url, '/my-tasks');
  assert.equal(notificationPayload({ ...notification, href: '/projects/project1' }).url, '/projects/project1');
  assert.equal(notificationPayload({ ...notification, message: 'x'.repeat(2000) }).body.length, 500);
});

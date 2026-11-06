import assert from 'node:assert/strict';
import test from 'node:test';
import webpush from 'web-push';
import { createConfiguredSenders } from './dispatcher.mjs';

test('configured Web Push sender retains TTL and requests high urgency', async () => {
  const keys = webpush.generateVAPIDKeys();
  const original = webpush.sendNotification;
  let options;
  webpush.sendNotification = async (_sub, _body, init) => { options = init; };
  try {
    const senders = createConfiguredSenders({ WEB_PUSH_VAPID_PUBLIC_KEY: keys.publicKey, WEB_PUSH_VAPID_PRIVATE_KEY: keys.privateKey, WEB_PUSH_SUBJECT: 'mailto:test@example.invalid' });
    await senders.webpush({ endpoint: 'https://fcm.googleapis.com/fcm/send/test', p256dh: keys.publicKey, auth: Buffer.alloc(16).toString('base64url') }, { title: 'Task' });
    assert.equal(options.urgency, 'high');
    assert.equal(options.TTL, 86400);
  } finally { webpush.sendNotification = original; }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import sharp from 'sharp';
import { isCollaboratorAllowedPath } from '../collaboratorRole.mjs';

test('badge is a 96px white monogram with a transparent background', async () => {
  const { data, info } = await sharp('public/icons/badge-96.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 96); assert.equal(info.height, 96);
  let transparent = 0; let white = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) transparent++;
    else { assert.equal(data[i], 255); assert.equal(data[i + 1], 255); assert.equal(data[i + 2], 255); white++; }
  }
  assert.ok(transparent > 2000 && white > 500);
});

test('worker shows push and restricts notification click to same-origin task/project links', async () => {
  const handlers = {}; const shown = []; const opened = [];
  vm.runInNewContext(readFileSync('public/sw.js', 'utf8'), { URL, self: {
    location: { origin: 'https://thoidai.online' }, addEventListener: (name, handler) => handlers[name] = handler,
    registration: { showNotification: async (...args) => shown.push(args) },
    clients: { matchAll: async () => [], openWindow: async url => opened.push(url) },
  } });
  assert.equal(typeof handlers.push, 'function');
  let pending;
  handlers.push({ data: { json: () => ({ title: 'Wrong', body: 'Task', url: '/tasks/abc', tag: 'n1' }) }, waitUntil: p => pending = p });
  await pending;
  assert.equal(shown[0][0], 'Wrong');
  assert.equal(shown[0][1].body, 'Task');
  assert.match(shown[0][1].icon, /^\/icons\//);
  assert.equal(shown[0][1].badge, '/icons/badge-96.png');
  assert.equal(shown[0][1].renotify, false);
  assert.equal(shown[0][1].requireInteraction, false);
  assert.equal(typeof shown[0][1].timestamp, 'number');
  assert.ok(shown[0][1].vibrate.length > 0);
  for (const url of ['/tasks/abc', 'https://evil.test/tasks/abc', '//evil.test', '/api/auth/logout']) {
    handlers.notificationclick({ notification: { data: { url }, close() {} }, waitUntil: p => pending = p });
    await pending;
  }
  assert.deepEqual(opened, ['https://thoidai.online/tasks/abc', 'https://thoidai.online/my-tasks', 'https://thoidai.online/my-tasks', 'https://thoidai.online/my-tasks']);
});
test('push configuration/subscriptions are permitted for CTV with exact methods only', () => {
  for (const [path, method] of [['/api/push/config', 'GET'], ['/api/push/subscribe','POST'], ['/api/push/unsubscribe','POST'], ['/api/mobile/push-token','POST'], ['/api/mobile/push-token','DELETE']]) assert.ok(isCollaboratorAllowedPath(path, method));
  assert.equal(isCollaboratorAllowedPath('/api/push/config','POST'), false);
  assert.equal(isCollaboratorAllowedPath('/api/push/dispatch','POST'), false);
});
test('browser push is user-initiated, iOS standalone-aware and hidden in APK', () => {
  const source = readFileSync('src/components/PushNotificationCard.tsx', 'utf8');
  assert.match(source, /ThoidaiWorkApp/);
  assert.match(source, /standalone/);
  assert.match(source, /onClick=\{enable\}/);
  assert.match(source, /Notification.requestPermission/);
  assert.match(source, /localStorage/);
});

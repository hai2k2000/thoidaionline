import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = 'mobile/thoidai_work_flutter/';
const bridgePath = `${root}lib/services/push_bridge.dart`;

test('native push configures a high importance channel before requesting a token', () => {
  const service = readFileSync(`${root}lib/services/native_push_service.dart`, 'utf8');
  const native = readFileSync(`${root}android/app/src/main/kotlin/online/thoidai/thoidai_work_flutter/MainActivity.kt`, 'utf8');
  const manifest = readFileSync(`${root}android/app/src/main/AndroidManifest.xml`, 'utf8');
  assert.ok(service.indexOf("'createNotificationChannel'") >= 0);
  assert.ok(service.indexOf("'createNotificationChannel'") < service.indexOf('messaging.getToken()'));
  assert.match(native, /NotificationManager\.IMPORTANCE_HIGH/);
  assert.match(native, /thoidai_tasks/);
  assert.match(native, /enableVibration\(true\)/);
  assert.match(native, /setSound\(/);
  assert.match(manifest, /com\.google\.firebase\.messaging\.default_notification_channel_id/);
  assert.match(service, /showTaskNotification/);
  assert.match(native, /setContentIntent/);
});
function fixture({ user = 'user-a', origin = 'https://thoidai.online', failDelete = false, postGate, onPost, postStatus = 200 } = {}) {
  assert.ok(existsSync(bridgePath), 'the authenticated native push bridge must exist');
  const source = readFileSync(bridgePath, 'utf8');
  const script = source.match(/const pushRegistrationScript = r'''([\s\S]*?)''';/)[1];
  const calls = [];
  const nativeCalls = [];
  const window = { location: { origin }, flutter_inappwebview: { callHandler: async name => { nativeCalls.push(name); return true; } } };
  window.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), ...init });
    if (String(url) === '/api/auth/session') return { ok: !!user, status: user ? 200 : 401, json: async () => ({ user: user ? { id: user } : null }) };
    if (init.method === 'POST' && String(url) === '/api/mobile/push-token') {
      onPost?.();
      await postGate;
      return { ok: postStatus === 200, status: postStatus, json: async () => ({ ok: postStatus === 200 }) };
    }
    if (init.method === 'DELETE' && failDelete) throw new Error('offline');
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  const context = vm.createContext({ window, URL, AbortController, setTimeout, clearTimeout, token: 'device-a', priorUserId: null, expectedOrigin: 'https://thoidai.online' });
  return { calls, nativeCalls, window, context, run: () => vm.runInContext(`(async () => {${script}\n})()`, context) };
}

test('native push registers only a current same-origin authenticated session and debounces repeat POSTs', async () => {
  const f = fixture();
  assert.equal((await f.run()).status, 'registered');
  assert.equal((await f.run()).status, 'registered');
  const posts = f.calls.filter(call => call.method === 'POST');
  assert.equal(posts.length, 1);
  assert.equal(posts[0].url, '/api/mobile/push-token');
  assert.equal(posts[0].credentials, 'include');
  assert.deepEqual(JSON.parse(posts[0].body), { token: 'device-a', platform: 'android' });
  assert.ok(f.calls.filter(call => call.url === '/api/auth/session').every(call => call.credentials === 'include' && call.cache === 'no-store'));
});

test('logged out, external origin and changed account cannot register a stale native token', async () => {
  for (const [options, expected] of [[{ user: null }, 'loggedOut'], [{ origin: 'https://evil.test' }, 'untrusted']]) {
    const f = fixture(options);
    assert.equal((await f.run()).status, expected);
    assert.equal(f.calls.filter(call => call.method === 'POST').length, 0);
  }
  const changed = fixture({ user: 'user-b' });
  changed.context.priorUserId = 'user-a';
  assert.equal((await changed.run()).status, 'accountChanged');
  assert.equal(changed.calls.filter(call => call.method === 'POST').length, 0);
});

test('token rotation is registered and a missing token waits for the native provider', async () => {
  const f = fixture();
  f.context.token = null;
  assert.equal((await f.run()).status, 'needsToken');
  f.context.token = 'device-a';
  await f.run();
  f.context.token = 'device-b';
  await f.run();
  assert.deepEqual(f.calls.filter(call => call.method === 'POST').map(call => JSON.parse(call.body).token), ['device-a', 'device-b']);
});

test('failed token registration is retried instead of entering the successful duplicate cache', async () => {
  const f = fixture({ postStatus: 503 });
  assert.equal((await f.run()).status, 'retry');
  assert.equal((await f.run()).status, 'retry');
  assert.equal(f.calls.filter(call => call.method === 'POST').length, 2);
});

test('logout waits for an in-flight registration before unregistering its token', async () => {
  let releasePost, markStarted;
  const postGate = new Promise(resolve => { releasePost = resolve; });
  const started = new Promise(resolve => { markStarted = resolve; });
  const f = fixture({ postGate, onPost: markStarted });
  const registration = f.run();
  await started;
  const logout = f.window.fetch('/api/auth/logout', { method: 'POST' });
  assert.equal(f.calls.some(call => call.method === 'DELETE'), false);
  releasePost();
  await Promise.all([registration, logout]);
  assert.deepEqual(f.calls.filter(call => call.method).map(call => call.method), ['POST', 'DELETE', 'POST']);
  assert.deepEqual(f.nativeCalls, ['tdPushLogout']);
});

test('both real logout endpoints unregister before logout and invalidate native token even if cleanup fails', async () => {
  for (const endpoint of ['/api/auth/logout', '/api/auth/mobile-logout']) {
    for (const failDelete of [false, true]) {
      const f = fixture({ failDelete });
      await f.run();
      await f.window.fetch(endpoint, { method: 'POST', credentials: 'include' });
      const deletion = f.calls.findIndex(call => call.method === 'DELETE');
      const logout = f.calls.findIndex(call => call.url === endpoint);
      assert.ok(deletion >= 0 && logout > deletion);
      assert.deepEqual(JSON.parse(f.calls[deletion].body), { token: 'device-a' });
      assert.deepEqual(f.nativeCalls, ['tdPushLogout']);
    }
  }
});

test('Android declares runtime camera/notification permission and a non-exported capture FileProvider', () => {
  const manifest = readFileSync(`${root}android/app/src/main/AndroidManifest.xml`, 'utf8');
  assert.match(manifest, /android\.permission\.CAMERA/);
  assert.match(manifest, /android\.permission\.POST_NOTIFICATIONS/);
  assert.match(manifest, /\$\{applicationId\}\.flutter_inappwebview_android\.fileprovider/);
  assert.match(manifest, /android:grantUriPermissions="true"/);
  assert.doesNotMatch(manifest, /WRITE_EXTERNAL_STORAGE|READ_EXTERNAL_STORAGE/);
  const native = readFileSync(`${root}android/app/src/main/kotlin/online/thoidai/thoidai_work_flutter/MainActivity.kt`, 'utf8');
  assert.match(native, /requestPermissions/);
  assert.match(native, /Manifest\.permission\.CAMERA/);
});

test('Firebase config is ignored and Google services is conditionally applied without disabling signing gates', () => {
  const gradle = readFileSync(`${root}android/app/build.gradle.kts`, 'utf8');
  assert.match(gradle, /if \(file\("google-services\.json"\)\.isFile\)/);
  assert.match(gradle, /apply\(plugin = "com\.google\.gms\.google-services"\)/);
  assert.match(gradle, /Release signing requires android\/key\.properties/);
  assert.match(readFileSync(`${root}.gitignore`, 'utf8'), /android\/app\/google-services\.json/);
});

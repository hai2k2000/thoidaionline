import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(path, 'utf8');
const dart = read('mobile/thoidai_work_flutter/lib/services/apk_update_service.dart');
const main = read('mobile/thoidai_work_flutter/lib/main.dart');
const manifest = read('mobile/thoidai_work_flutter/android/app/src/main/AndroidManifest.xml');
test('Flutter updater compares installed build number and verifies file before installer', () => {
  assert.match(main, /int.tryParse\(info.buildNumber\)/);
  assert.match(dart, /manifest.versionCode <= installedVersionCode/);
  const install = dart.slice(dart.indexOf('Future<void> _install('));
  assert.ok(install.indexOf('await _verify(file, manifest)') < install.indexOf('await OpenFilex.open('));
  assert.match(dart, /await file.length\(\) != manifest.size/);
  assert.match(dart, /sha256.bind\(file.openRead\(\)\).first/);
  assert.match(dart, /file.delete\(\)/);
  assert.match(dart, /received > manifest.size/);
});
test('APK requests use WebView cookies with HTTPS same-host and no redirects', () => {
  assert.match(dart, /CookieManager.instance\(\).getCookies/);
  assert.match(dart, /request.headers\['Cookie'\]/);
  assert.match(dart, /uri.scheme == 'https' && uri.host == base.host/);
  assert.match(dart, /uri.port == base.port && uri.userInfo.isEmpty/);
  assert.match(dart, /followRedirects = false/);
  assert.match(dart, /if \(!_sameHost\(uri\)\) throw/);
});
test('throttle and snooze persist; manual checks and private cleanup are wired', () => {
  assert.match(dart, /Duration\(hours: 6\)/);
  assert.match(dart, /Duration\(hours: 24\)/);
  assert.match(dart, /apk-update-state.json/);
  assert.match(dart, /apk-updates/);
  assert.match(dart, /list\(followLinks: false\)/);
  assert.match(main, /tdCheckApkUpdate/);
  assert.match(main, /_apkUpdates.check\(context, manual: true\)/);
  assert.match(main, /Use the verified APK updater/);
});
test('APK updater requests permission and opens package-specific Android settings', () => {
  assert.match(manifest, /REQUEST_INSTALL_PACKAGES/);
  const kotlin = read('mobile/thoidai_work_flutter/android/app/src/main/kotlin/online/thoidai/thoidai_work_flutter/MainActivity.kt');
  assert.match(kotlin, /canRequestPackageInstalls/);
  assert.match(kotlin, /ACTION_MANAGE_UNKNOWN_APP_SOURCES/);
  assert.match(kotlin, /package:\$packageName/);
  assert.match(read('mobile/thoidai_work_flutter/pubspec.yaml'), /^version: 1.0.3\+5$/m);
});

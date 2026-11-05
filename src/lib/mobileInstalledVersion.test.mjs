import test from 'node:test';
import assert from 'node:assert/strict';
import { installedApkVersion, isApkOlder } from './mobileInstalledVersion.mjs';
test('APK UA supports old versions and new build-number suffix', () => {
  assert.equal(installedApkVersion('Mozilla/5.0'), null);
  assert.deepEqual(installedApkVersion('Mozilla ThoidaiWorkApp/1.0.2'), {version: '1.0.2', versionCode: null});
  assert.deepEqual(installedApkVersion('Mozilla ThoidaiWorkApp/1.0.3+5'), {version: '1.0.3', versionCode: 5});
});
test('older hint compares numerically, not lexically or by inequality', () => {
  const latest = {version: '1.0.10', versionCode: 8};
  assert.equal(isApkOlder({version:'1.0.2',versionCode:null}, latest), true);
  assert.equal(isApkOlder({version:'1.1.0',versionCode:null}, latest), false);
  assert.equal(isApkOlder({version:'1.0.10',versionCode:7}, latest), true);
  assert.equal(isApkOlder({version:'1.0.10',versionCode:8}, latest), false);
});

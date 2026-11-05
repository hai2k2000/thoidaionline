import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseApkManifest, isValidApkFileName, readApkManifest, openApkFile } from "./mobileApk.mjs";

const manifest = { version: "1.0.0", versionCode: 2, fileName: "thoidai-work-1.0.0.apk", size: 3, sha256: "a".repeat(64), publishedAt: "2026-11-05T00:00:00.000Z" };
test("manifest validates and exposes only distribution fields", () => {
  assert.deepEqual(parseApkManifest({ ...manifest, secret: "ignored" }), manifest);
  for (const patch of [{ size: -1 }, { versionCode: 1.5 }, { sha256: "bad" }, { publishedAt: "bad" }, { version: "" }, { fileName: "../a.apk" }]) {
    assert.throws(() => parseApkManifest({ ...manifest, ...patch }));
  }
});
test("APK filenames cannot traverse or inject headers", () => {
  assert.equal(isValidApkFileName("thoidai-work-1.0.0+2.apk"), true);
  for (const name of ["../a.apk", "a/b.apk", "a\\b.apk", "%2e.apk", "a.apk\r\n", "a.zip", "", null]) assert.equal(isValidApkFileName(name), false);
});
test("missing manifest and missing APK return not found; valid APK opens", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mobile-apk-"));
  try {
    await assert.rejects(readApkManifest(dir), { code: "ENOENT" });
    await writeFile(join(dir, "latest.json"), JSON.stringify(manifest));
    assert.deepEqual(await readApkManifest(dir), manifest);
    await assert.rejects(openApkFile(dir, manifest), { code: "ENOENT" });
    await writeFile(join(dir, manifest.fileName), "apk");
    const handle = await openApkFile(dir, manifest);
    assert.equal((await handle.stat()).size, 3);
    await handle.close();
    await assert.rejects(openApkFile(dir, { ...manifest, size: 4 }));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

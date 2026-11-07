import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { avatarTargetSize, shouldKeepAvatarFile } from "./avatarImage.mjs";

test("avatarTargetSize preserves aspect ratio without upscaling", () => {
  assert.deepEqual(avatarTargetSize(4000, 3000), { width: 1024, height: 768 });
  assert.deepEqual(avatarTargetSize(3000, 4000), { width: 768, height: 1024 });
  assert.deepEqual(avatarTargetSize(800, 600), { width: 800, height: 600 });
  assert.deepEqual(avatarTargetSize(100000, 1), { width: 1024, height: 1 });
});
test("shouldKeepAvatarFile accepts only small supported images", () => {
  assert.equal(shouldKeepAvatarFile({ type: "image/jpeg", size: 512 * 1024 }), true);
  assert.equal(shouldKeepAvatarFile({ type: "image/heic", size: 100 }), false);
  assert.equal(shouldKeepAvatarFile({ type: "image/jpeg", size: 3 * 1024 * 1024 }), false);
});
test("AccountShell prepares avatars before upload", async () => {
  const source = await readFile(new URL("../components/AccountShell.tsx", import.meta.url), "utf8");
  assert.match(source, /prepareAvatarImage/);
  assert.doesNotMatch(source, /file\.size>2\*1024\*1024/);
});
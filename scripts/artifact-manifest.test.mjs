import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeManifest } from "./artifact-manifest.mjs";
import { verifyManifest } from "./verify-artifact-manifest.mjs";

test("artifact manifest records and verifies files", async () => {
  const root = await mkdtemp(join(tmpdir(), "thoidai-artifact-"));
  try {
    await writeFile(join(root, "server.js"), "ok\n");
    await writeManifest(root);
    assert.equal(await verifyManifest(root), 1);
    assert.doesNotMatch(await readFile(join(root, ".artifact-manifest.json"), "utf8"), /artifact-manifest\.sha256/);
    await writeFile(join(root, "server.js"), "tampered\n");
    await assert.rejects(() => verifyManifest(root), /artifact size mismatch|artifact checksum mismatch/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

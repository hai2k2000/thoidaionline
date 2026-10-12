import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export async function verifyManifest(root) {
  const manifestBody = await readFile(join(root, ".artifact-manifest.json"), "utf8");
  const checksum = (await readFile(join(root, ".artifact-manifest.sha256"), "utf8")).trim().split(/\s+/, 1)[0];
  assert.equal(createHash("sha256").update(manifestBody).digest("hex"), checksum, "artifact manifest checksum mismatch");
  const manifest = JSON.parse(manifestBody);
  assert.equal(manifest.schema_version, 1, "unsupported artifact manifest schema");
  assert.ok(Array.isArray(manifest.files) && manifest.files.length > 0, "artifact manifest is empty");
  for (const entry of manifest.files) {
    assert.match(entry.path, /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$)).+/, `unsafe manifest path: ${entry.path}`);
    const path = resolve(root, entry.path);
    assert.ok(path.startsWith(`${resolve(root)}${process.platform === "win32" ? "\\" : "/"}`), `manifest path escapes artifact: ${entry.path}`);
    const stat = await lstat(path);
    if (entry.type === "symlink") {
      assert.ok(stat.isSymbolicLink(), `expected symlink: ${entry.path}`);
      continue;
    }
    assert.ok(stat.isFile(), `expected file: ${entry.path}`);
    const bytes = await readFile(path);
    assert.equal(bytes.length, entry.bytes, `artifact size mismatch: ${entry.path}`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256, `artifact checksum mismatch: ${entry.path}`);
  }
  return manifest.files.length;
}

if (process.argv[1]?.endsWith("verify-artifact-manifest.mjs")) {
  const root = resolve(process.argv[2] || process.cwd());
  const count = await verifyManifest(root);
  console.log(`artifact-checksum: PASS (${count} entries)`);
}

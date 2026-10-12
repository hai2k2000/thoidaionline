import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile, readlink, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

export async function verifyManifest(root) {
  const manifestBody = await readFile(join(root, ".artifact-manifest.json"), "utf8");
  const checksum = (await readFile(join(root, ".artifact-manifest.sha256"), "utf8")).trim().split(/\s+/, 1)[0];
  assert.equal(createHash("sha256").update(manifestBody).digest("hex"), checksum, "artifact manifest checksum mismatch");
  const manifest = JSON.parse(manifestBody);
  assert.equal(manifest.schema_version, 1, "unsupported artifact manifest schema");
  assert.ok(Array.isArray(manifest.files) && manifest.files.length > 0, "artifact manifest is empty");
  const seen = new Set();
  for (const entry of manifest.files) {
    assert.ok(!seen.has(entry.path), `duplicate manifest path: ${entry.path}`);
    seen.add(entry.path);
    assert.match(entry.path, /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$)).+/, `unsafe manifest path: ${entry.path}`);
    const path = resolve(root, entry.path);
    assert.ok(path.startsWith(`${resolve(root)}${process.platform === "win32" ? "\\" : "/"}`), `manifest path escapes artifact: ${entry.path}`);
    const stat = await lstat(path);
    assert.ok(entry.type === "file" || entry.type === "symlink", `unsupported manifest entry type: ${entry.type}`);
    if (entry.type === "symlink") {
      assert.ok(stat.isSymbolicLink(), `expected symlink: ${entry.path}`);
      assert.ok(await readlink(path), `empty symlink target: ${entry.path}`);
      continue;
    }
    assert.ok(stat.isFile(), `expected file: ${entry.path}`);
    const bytes = await readFile(path);
    assert.equal(bytes.length, entry.bytes, `artifact size mismatch: ${entry.path}`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256, `artifact checksum mismatch: ${entry.path}`);
  }
  const expected = new Set();
  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const rel = path.slice(resolve(root).length + 1).replaceAll("\\", "/");
      if (rel === ".artifact-manifest.json" || rel === ".artifact-manifest.sha256" || rel === ".env.local" || rel === ".env.production" || rel === ".next/cache" || rel.startsWith(".next/cache/")) continue;
      if (entry.isSymbolicLink() || entry.isFile()) expected.add(rel);
      else if (entry.isDirectory()) await collect(path);
    }
  }
  await collect(resolve(root));
  assert.deepEqual([...seen].sort(), [...expected].sort(), "artifact manifest coverage mismatch");
  return manifest.files.length;
}

if (process.argv[1]?.endsWith("verify-artifact-manifest.mjs")) {
  const root = resolve(process.argv[2] || process.cwd());
  const count = await verifyManifest(root);
  console.log(`artifact-checksum: PASS (${count} entries)`);
}

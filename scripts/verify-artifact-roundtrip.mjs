import assert from "node:assert/strict";
import { lstat, readdir, readlink } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(process.argv[2] || process.cwd());

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) {
      const target = await readlink(path);
      const resolvedTarget = resolve(dirname(path), target);
      assert.ok(!target.startsWith("/"), `absolute symlink target: ${relative(root, path)}`);
      assert.ok(
        resolvedTarget === root || resolvedTarget.startsWith(`${root}/`),
        `symlink escapes artifact: ${relative(root, path)}`,
      );
    } else if (stat.isDirectory()) {
      await walk(path);
    }
  }
}

await walk(root);
console.log("artifact-roundtrip: PASS");

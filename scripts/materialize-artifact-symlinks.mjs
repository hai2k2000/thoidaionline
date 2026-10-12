import assert from "node:assert/strict";
import { cp, lstat, readlink, readdir, rm } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const root = resolve(process.argv[2] || process.cwd());

function isInside(path) {
  const rel = relative(root, path);
  return rel === "" || (!isAbsolute(rel) && !rel.startsWith(".."));
}

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) {
      const target = await readlink(path);
      const resolvedTarget = resolve(dirname(path), target);
      assert.ok(isInside(resolvedTarget), `artifact symlink escapes root: ${relative(root, path)}`);
      await rm(path, { force: true, recursive: true });
      await cp(resolvedTarget, path, { recursive: true, dereference: true, errorOnExist: true });
    } else if (stat.isDirectory()) {
      await walk(path);
    }
  }
}

await walk(root);
console.log("artifact-symlink-materialization: PASS");

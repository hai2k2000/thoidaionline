import { createHash } from "node:crypto";
import { lstat, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const IGNORED = new Set([".env.local", ".env.production", ".next/cache", ".deploy-success"]);

async function collect(root, current = root, rows = []) {
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    const rel = relative(root, path).replaceAll("\\", "/");
    if ([...IGNORED].some((name) => rel === name || rel.startsWith(`${name}/`))) continue;
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) {
      rows.push({ path: rel, type: "symlink" });
    } else if (stat.isDirectory()) {
      await collect(root, path, rows);
    } else if (stat.isFile()) {
      const bytes = await readFile(path);
      rows.push({ path: rel, type: "file", bytes: stat.size, sha256: createHash("sha256").update(bytes).digest("hex") });
    }
  }
  return rows;
}

export async function writeManifest(root) {
  const files = (await collect(root)).sort((a, b) => a.path.localeCompare(b.path));
  const body = `${JSON.stringify({ schema_version: 1, files }, null, 2)}\n`;
  await writeFile(join(root, ".artifact-manifest.json"), body);
  await writeFile(join(root, ".artifact-manifest.sha256"), `${createHash("sha256").update(body).digest("hex")}  .artifact-manifest.json\n`);
  return files;
}

if (process.argv[1] && process.argv[1].endsWith("artifact-manifest.mjs")) {
  const root = process.argv[2] || process.cwd();
  await writeManifest(root);
  console.log(`artifact-manifest: PASS (${root})`);
}

import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { statfsSync } from "node:fs";
import path from "node:path";

export const HARD_MIN_FREE_BYTES = 10 * 1024 ** 3;
export const WARNING_FREE_BYTES = 20 * 1024 ** 3;

const sha256 = async (filePath) => {
  const digest = createHash("sha256");
  digest.update(await readFile(filePath));
  return digest.digest("hex");
};

const freeBytes = (directory) => {
  const fs = statfsSync(directory);
  return Number(fs.bavail) * Number(fs.bsize);
};

const ensureWithin = (root, candidate) => {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  if (resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("path_outside_backup_root");
  return resolvedCandidate;
};

async function collectFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(root, full));
    else if (entry.isFile()) files.push({ path: path.relative(root, full).replaceAll(path.sep, "/"), full });
  }
  return files;
}

export async function createBackup({ databaseDump, storageRoot, outputRoot, sourceLabel = "synthetic" }) {
  const output = path.resolve(outputRoot);
  const dump = path.resolve(databaseDump);
  const storage = path.resolve(storageRoot);
  if (sourceLabel !== "synthetic") throw new Error("synthetic_only");
  if ((await stat(dump)).isDirectory()) throw new Error("database_dump_must_be_file");
  if (!(await stat(storage)).isDirectory()) throw new Error("storage_root_must_be_directory");
  if (output === dump || output.startsWith(`${dump}${path.sep}`) || output === storage || output.startsWith(`${storage}${path.sep}`)) throw new Error("output_overlaps_source");
  const estimated = (await stat(dump)).size;
  const free = freeBytes(path.dirname(output));
  if (free < HARD_MIN_FREE_BYTES || free - estimated < HARD_MIN_FREE_BYTES) throw new Error("disk_guard_blocked");
  await mkdir(output, { recursive: true });
  await cp(dump, path.join(output, "database.dump"));
  const files = await collectFiles(storage);
  for (const file of files) {
    const target = ensureWithin(output, path.join(output, "files", file.path));
    await mkdir(path.dirname(target), { recursive: true });
    await cp(file.full, target);
  }
  const members = [{ path: "database.dump", sha256: await sha256(path.join(output, "database.dump")), size: (await stat(path.join(output, "database.dump"))).size }];
  for (const file of files) {
    const target = path.join(output, "files", file.path);
    members.push({ path: path.join("files", file.path).replaceAll(path.sep, "/"), sha256: await sha256(target), size: (await stat(target)).size });
  }
  const manifest = { format: 1, source: sourceLabel, created_at: new Date().toISOString(), members };
  await writeFile(path.join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

export async function verifyBackup(backupRoot) {
  const root = path.resolve(backupRoot);
  const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
  if (manifest.source !== "synthetic" || manifest.format !== 1 || !Array.isArray(manifest.members)) throw new Error("invalid_backup_manifest");
  for (const member of manifest.members) {
    const file = ensureWithin(root, path.join(root, member.path));
    const info = await stat(file);
    if (!info.isFile() || info.size !== member.size || await sha256(file) !== member.sha256) throw new Error(`backup_integrity_failed:${member.path}`);
  }
  return manifest;
}

export async function restoreBackup({ backupRoot, restoreRoot }) {
  const manifest = await verifyBackup(backupRoot);
  const output = path.resolve(restoreRoot);
  if (output === path.resolve(backupRoot) || output.startsWith(`${path.resolve(backupRoot)}${path.sep}`)) throw new Error("restore_overlaps_backup");
  const free = freeBytes(path.dirname(output));
  const bytes = manifest.members.reduce((total, member) => total + member.size, 0);
  if (free < HARD_MIN_FREE_BYTES || free - bytes < HARD_MIN_FREE_BYTES) throw new Error("disk_guard_blocked");
  await mkdir(output, { recursive: true });
  for (const member of manifest.members) {
    const source = path.join(path.resolve(backupRoot), member.path);
    const target = ensureWithin(output, path.join(output, member.path));
    await mkdir(path.dirname(target), { recursive: true });
    await cp(source, target);
  }
  await writeFile(path.join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await verifyBackup(output);
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  const [command, backupRoot, restoreRoot] = process.argv.slice(2);
  if (command === "verify") await verifyBackup(backupRoot);
  else if (command === "restore") await restoreBackup({ backupRoot, restoreRoot });
  else throw new Error("usage: node scripts/database-v1-backup.mjs verify <backup-root> | restore <backup-root> <restore-root>");
  console.log("DATABASE_V1_BACKUP_PASS");
}

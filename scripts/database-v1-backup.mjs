import { createHash, randomUUID } from "node:crypto";
import { cp, lstat, mkdir, readFile, readdir, realpath, rename, rm, statfs, writeFile } from "node:fs/promises";
import path from "node:path";

export const HARD_MIN_FREE_BYTES = 10 * 1024 ** 3;
export const WARNING_FREE_BYTES = 20 * 1024 ** 3;

const sha256 = async (filePath) => {
  const digest = createHash("sha256");
  const handle = await import("node:fs/promises").then(({ open }) => open(filePath, "r"));
  try {
    for await (const chunk of handle.readableWebStream()) digest.update(Buffer.from(chunk));
  } finally {
    await handle.close();
  }
  return digest.digest("hex");
};

const freeBytes = async (directory) => {
  const fs = await statfs(directory);
  return Number(fs.bavail) * Number(fs.bsize);
};

const ensureWithin = (root, candidate) => {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  if (resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("path_outside_backup_root");
  return resolvedCandidate;
};

const validateMemberPath = (memberPath) => {
  if (typeof memberPath !== "string" || !memberPath || path.isAbsolute(memberPath) || memberPath.includes("\\") || memberPath.split("/").some((part) => !part || part === "." || part === "..")) throw new Error("invalid_manifest_path");
  return memberPath;
};

const assertDisk = async (directory, requiredBytes) => {
  const free = await freeBytes(directory);
  if (free < HARD_MIN_FREE_BYTES || free - requiredBytes < HARD_MIN_FREE_BYTES) throw new Error("disk_guard_blocked");
};

async function collectFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(current, entry.name);
    const info = await lstat(full);
    if (info.isSymbolicLink()) throw new Error("source_symlink_not_allowed");
    if (entry.isDirectory()) files.push(...await collectFiles(root, full));
    else if (entry.isFile()) files.push({ path: path.relative(root, full).replaceAll(path.sep, "/"), full, size: info.size });
    else throw new Error("unsupported_source_entry");
  }
  return files;
}

const assertNewDestination = async (destination) => {
  const parent = path.dirname(destination);
  if (await realpath(parent) !== parent) throw new Error("destination_parent_symlink");
  try { await lstat(destination); throw new Error("destination_exists"); } catch (error) { if (error?.code !== "ENOENT") throw error; }
};

const stagePath = (destination) => `${destination}.partial-${process.pid}-${randomUUID()}`;

export async function createBackup({ databaseDump, storageRoot, outputRoot, sourceLabel = "synthetic" }) {
  const output = path.resolve(outputRoot);
  const dump = path.resolve(databaseDump);
  const storage = path.resolve(storageRoot);
  if (sourceLabel !== "synthetic") throw new Error("synthetic_only");
  const dumpInfo = await lstat(dump);
  const storageInfo = await lstat(storage);
  if (!dumpInfo.isFile() || dumpInfo.isSymbolicLink()) throw new Error("database_dump_must_be_regular_file");
  if (!storageInfo.isDirectory() || storageInfo.isSymbolicLink()) throw new Error("storage_root_must_be_directory");
  if (output === dump || output.startsWith(`${dump}${path.sep}`) || output === storage || output.startsWith(`${storage}${path.sep}`)) throw new Error("output_overlaps_source");
  const files = await collectFiles(storage);
  await assertNewDestination(output);
  const totalBytes = dumpInfo.size + files.reduce((total, file) => total + file.size, 0);
  await assertDisk(path.dirname(output), totalBytes);
  const staging = stagePath(output);
  try {
    await mkdir(staging, { recursive: true });
    await cp(dump, path.join(staging, "database.dump"), { errorOnExist: true, force: false });
    let copied = dumpInfo.size;
    for (const file of files) {
      await assertDisk(path.dirname(output), totalBytes - copied);
      const target = ensureWithin(staging, path.join(staging, "files", file.path));
      await mkdir(path.dirname(target), { recursive: true });
      await cp(file.full, target, { errorOnExist: true, force: false });
      copied += file.size;
    }
    const members = [{ path: "database.dump", sha256: await sha256(path.join(staging, "database.dump")), size: dumpInfo.size }];
    for (const file of files) {
      const target = path.join(staging, "files", file.path);
      members.push({ path: `files/${file.path}`, sha256: await sha256(target), size: file.size });
    }
    const manifest = { format: 1, source: sourceLabel, created_at: new Date().toISOString(), members };
    await writeFile(path.join(staging, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await verifyBackup(staging);
    await assertNewDestination(output);
    await rename(staging, output);
    return manifest;
  } catch (error) {
    await rm(staging, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

export async function verifyBackup(backupRoot) {
  const root = path.resolve(backupRoot);
  const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
  if (manifest.source !== "synthetic" || manifest.format !== 1 || !Array.isArray(manifest.members) || manifest.members.length < 1) throw new Error("invalid_backup_manifest");
  const seen = new Set();
  for (const member of manifest.members) {
    validateMemberPath(member.path);
    if (seen.has(member.path) || typeof member.sha256 !== "string" || !Number.isSafeInteger(member.size) || member.size < 0) throw new Error("invalid_manifest_member");
    seen.add(member.path);
    const file = ensureWithin(root, path.join(root, member.path));
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size !== member.size || await sha256(file) !== member.sha256) throw new Error(`backup_integrity_failed:${member.path}`);
  }
  if (!seen.has("database.dump")) throw new Error("backup_missing_database_dump");
  return manifest;
}

export async function restoreBackup({ backupRoot, restoreRoot }) {
  const manifest = await verifyBackup(backupRoot);
  const output = path.resolve(restoreRoot);
  const backup = path.resolve(backupRoot);
  if (output === backup || output.startsWith(`${backup}${path.sep}`)) throw new Error("restore_overlaps_backup");
  await assertNewDestination(output);
  const bytes = manifest.members.reduce((total, member) => total + member.size, 0);
  await assertDisk(path.dirname(output), bytes);
  const staging = stagePath(output);
  try {
    await mkdir(staging, { recursive: true });
    let copied = 0;
    for (const member of manifest.members) {
      const source = ensureWithin(backup, path.join(backup, validateMemberPath(member.path)));
      const target = ensureWithin(staging, path.join(staging, member.path));
      await assertDisk(path.dirname(output), bytes - copied);
      await mkdir(path.dirname(target), { recursive: true });
      await cp(source, target, { errorOnExist: true, force: false });
      copied += member.size;
    }
    await writeFile(path.join(staging, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await verifyBackup(staging);
    await assertNewDestination(output);
    await rename(staging, output);
    return manifest;
  } catch (error) {
    await rm(staging, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  const [command, backupRoot, restoreRoot] = process.argv.slice(2);
  if (command === "verify") await verifyBackup(backupRoot);
  else if (command === "restore") await restoreBackup({ backupRoot, restoreRoot });
  else throw new Error("usage: node scripts/database-v1-backup.mjs verify <backup-root> | restore <backup-root> <restore-root>");
  console.log("DATABASE_V1_BACKUP_PASS");
}

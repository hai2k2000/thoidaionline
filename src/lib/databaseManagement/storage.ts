import "server-only";
import { legacyOfficeMime, hasOle2Magic } from "../legacyOffice.mjs";

import { createHash } from "node:crypto";
import { mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { databaseRecordStorageKey } from "./storageKey";
import { databaseRecordFileType } from "./fileType.mjs";

const MAX_FILE_BYTES = 150 * 1024 * 1024;
const ALLOWED = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const STORAGE_KEY = /^[0-9a-f-]{36}\/[a-zA-Z0-9_-]+\.[a-z0-9]{1,12}$/i;

export function databaseRecordStorageRoot() {
  return process.env.DATABASE_RECORD_STORAGE_ROOT || path.resolve(process.cwd(), "..", "thoidai-work-data", "database-records");
}

export async function writeDatabaseRecordFile(recordId: string, file: { name: string; bytes: Uint8Array; mimeType: string }, requestId?: string) {
  if (!/^[0-9a-f-]{36}$/i.test(recordId)) throw new Error("invalid_record_id");
  const mimeType = databaseRecordFileType(file.name);
  if (!mimeType || !ALLOWED.has(mimeType) || file.mimeType !== mimeType || file.bytes.byteLength <= 0 || file.bytes.byteLength > MAX_FILE_BYTES) throw new Error("invalid_file");
  if (legacyOfficeMime(file.name) && !hasOle2Magic(file.bytes)) throw new Error("invalid_file");
  const bytes = file.bytes;
  const key = databaseRecordStorageKey(recordId, file.name, requestId);
  const root = path.resolve(databaseRecordStorageRoot());
  const target = path.resolve(root, key);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error("invalid_storage_key");
  await mkdir(path.dirname(target), { recursive: true, mode: 0o750 });
  const resolvedRoot = await realpath(root);
  const resolvedParent = await realpath(path.dirname(target));
  if (resolvedParent !== resolvedRoot && !resolvedParent.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("invalid_storage_key");
  let created = false;
  try {
    await writeFile(target, bytes, { flag: "wx", mode: 0o640 });
    created = true;
  } catch (error) {
    if (!(requestId && error && typeof error === "object" && "code" in error && error.code === "EEXIST")) throw error;
    const existing = await readFile(target);
    if (existing.length !== bytes.length || createHash("sha256").update(existing).digest("hex") !== createHash("sha256").update(bytes).digest("hex")) throw new Error("idempotency_conflict");
  }
  return { storageKey: key.replaceAll(path.sep, "/"), sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), created };
}

export async function readDatabaseRecordFile(storageKey: string) {
  if (!STORAGE_KEY.test(storageKey)) throw new Error("invalid_storage_key");
  const root = path.resolve(databaseRecordStorageRoot());
  const target = path.resolve(root, storageKey);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error("invalid_storage_key");
  const resolvedRoot = await realpath(root);
  const resolvedTarget = await realpath(target);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("invalid_storage_key");
  const bytes = await readFile(target);
  return { bytes, sha256: createHash("sha256").update(bytes).digest("hex") };
}

export async function removeDatabaseRecordFile(storageKey: string) {
  if (!STORAGE_KEY.test(storageKey)) throw new Error("invalid_storage_key");
  const root = path.resolve(databaseRecordStorageRoot());
  const target = path.resolve(root, storageKey);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error("invalid_storage_key");
  const resolvedRoot = await realpath(root);
  const resolvedTarget = await realpath(target).catch(() => target);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("invalid_storage_key");
  await rm(target, { force: true });
}

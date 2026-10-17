import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { databaseRecordStorageKey } from "./storageKey";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ALLOWED = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export function databaseRecordStorageRoot() {
  return process.env.DATABASE_RECORD_STORAGE_ROOT || path.resolve(process.cwd(), "..", "thoidai-work-data", "database-records");
}

export async function writeDatabaseRecordFile(recordId: string, file: { name: string; type: string; size: number; arrayBuffer(): Promise<ArrayBuffer> }) {
  if (!/^[0-9a-f-]{36}$/i.test(recordId)) throw new Error("invalid_record_id");
  if (!ALLOWED.has(file.type) || file.size <= 0 || file.size > MAX_FILE_BYTES) throw new Error("invalid_file");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size) throw new Error("invalid_file_size");
  const key = databaseRecordStorageKey(recordId, file.name);
  const root = path.resolve(databaseRecordStorageRoot());
  const target = path.resolve(root, key);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error("invalid_storage_key");
  await mkdir(path.dirname(target), { recursive: true, mode: 0o750 });
  await writeFile(target, bytes, { flag: "wx", mode: 0o640 });
  return { storageKey: key.replaceAll(path.sep, "/"), sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
}

export async function readDatabaseRecordFile(storageKey: string) {
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]+\.[a-z0-9]{1,12}$/i.test(storageKey)) throw new Error("invalid_storage_key");
  const root = path.resolve(databaseRecordStorageRoot());
  const target = path.resolve(root, storageKey);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error("invalid_storage_key");
  const bytes = await readFile(target);
  return { bytes, sha256: createHash("sha256").update(bytes).digest("hex") };
}

export async function removeDatabaseRecordFile(storageKey: string) {
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]+\.[a-z0-9]{1,12}$/i.test(storageKey)) throw new Error("invalid_storage_key");
  const root = path.resolve(databaseRecordStorageRoot());
  const target = path.resolve(root, storageKey);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error("invalid_storage_key");
  await rm(target, { force: true });
}

import path from "node:path";
import { randomUUID } from "node:crypto";

export function databaseRecordStorageKey(recordId: string, originalName: string) {
  const extension = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 12);
  return path.join(recordId, `${randomUUID()}${extension}`);
}

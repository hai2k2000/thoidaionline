import path from "node:path";
import { randomUUID } from "node:crypto";

export function databaseRecordStorageKey(recordId: string, originalName: string, requestId?: string) {
  const extension = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 12);
  const stableId = requestId && /^[a-zA-Z0-9_-]{8,200}$/.test(requestId) ? requestId : randomUUID();
  return path.join(recordId, requestId ? `${stableId}.bin` : `${stableId}${extension}`);
}

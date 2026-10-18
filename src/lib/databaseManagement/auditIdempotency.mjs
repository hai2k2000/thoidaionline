import { randomUUID } from "node:crypto";

export function newAuditIdempotencyKey(explicitKey) {
  return explicitKey || randomUUID();
}

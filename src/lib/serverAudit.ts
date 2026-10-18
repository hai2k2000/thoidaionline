import "server-only";

import { enqueueAndDeliverAudit, type AuditOutboxInput } from "@/lib/databaseManagement/auditOutbox";

export type ServerAuditInput = AuditOutboxInput;

export async function logServerAudit(
  input: ServerAuditInput,
): Promise<"delivered" | "pending"> {
  const result = await enqueueAndDeliverAudit(input);
  return result.status;
}

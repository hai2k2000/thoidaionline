import "server-only";

import { serverSupabase } from "@/lib/serverSupabase";

export type ServerAuditInput = {
  actorId: string;
  module: "admin" | "task" | "performance";
  entityType: string;
  entityId?: string | null;
  action: string;
  oldData?: unknown;
  newData?: unknown;
};

export async function logServerAudit(
  input: ServerAuditInput,
): Promise<void> {
  const { error } = await serverSupabase.from("audit_logs").insert({
    actor_id: input.actorId,
    module: input.module,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    action: input.action,
    old_data: input.oldData ?? null,
    new_data: input.newData ?? null,
  });
  if (error) throw new Error("server_audit_failed");
}

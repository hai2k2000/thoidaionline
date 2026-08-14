import { db, fail, ok, ServiceResult, withError } from "./common";

export type AuditInput = {
  actorId?: string | null;
  module: "hr" | "performance" | "assets" | "documents" | "admin";
  entityType: string;
  entityId?: string | null;
  action: "create" | "update" | "delete" | "assign" | "unassign" | "submit" | "approve";
  oldData?: unknown;
  newData?: unknown;
};

export async function logAudit(input: AuditInput): Promise<ServiceResult<true>> {
  try {
    const payload = {
      actor_id: input.actorId ?? null,
      module: input.module,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      action: input.action,
      old_data: input.oldData ?? null,
      new_data: input.newData ?? null,
    };

    const { error } = await db.from("audit_logs").insert(payload);
    if (error) return fail(error.message);
    return ok(true);
  } catch (error) {
    return fail(withError(error, "Không ghi được audit log."));
  }
}

import "server-only";

import { createHash } from "node:crypto";
import { serverSupabase } from "@/lib/serverSupabase";

type AuditPayload = Record<string, unknown>;
export type AuditOutboxInput = {
  actorId: string;
  module: "admin" | "task" | "performance" | "assets" | "database";
  entityType: string;
  entityId?: string | null;
  action: string;
  oldData?: unknown;
  newData?: unknown;
  idempotencyKey?: string;
};

const SENSITIVE_KEY = /(password|token|secret|cookie|authorization|private[_-]?key|content|bytes)/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.length > 500 ? `${value.slice(0, 500)}...[truncated]` : value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitize(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 100).map(([key, item]) => [key, SENSITIVE_KEY.test(key) ? "[redacted]" : sanitize(item, depth + 1)]));
  }
  return "[unsupported]";
}

function payloadFor(input: AuditOutboxInput): AuditPayload {
  return { old_data: sanitize(input.oldData ?? null), new_data: sanitize(input.newData ?? null) };
}

function keyFor(input: AuditOutboxInput, payload: AuditPayload) {
  if (input.idempotencyKey) return input.idempotencyKey;
  return createHash("sha256").update(JSON.stringify({ actor: input.actorId, module: input.module, entity: input.entityId ?? null, action: input.action, payload })).digest("hex");
}

export async function enqueueAndDeliverAudit(input: AuditOutboxInput) {
  const payload = payloadFor(input);
  const idempotencyKey = keyFor(input, payload);
  const { data: existing, error: existingError } = await serverSupabase.from("database_audit_outbox").select("id,status").eq("idempotency_key", idempotencyKey).maybeSingle();
  if (existingError) throw new Error("audit_outbox_unavailable");
  let outboxId = existing?.id;
  if (!outboxId) {
    const { data, error } = await serverSupabase.from("database_audit_outbox").insert({ idempotency_key: idempotencyKey, actor_id: input.actorId, module: input.module, entity_type: input.entityType, entity_id: input.entityId ?? null, action: input.action, payload }).select("id").single();
    if (error) {
      const retry = await serverSupabase.from("database_audit_outbox").select("id").eq("idempotency_key", idempotencyKey).maybeSingle();
      if (retry.error || !retry.data) throw new Error("audit_outbox_unavailable");
      outboxId = retry.data.id;
    } else outboxId = data.id;
  }
  if (existing?.status === "delivered") return { status: "delivered" as const, outboxId };
  const { error: auditError } = await serverSupabase.from("audit_logs").insert({ idempotency_key: idempotencyKey, actor_id: input.actorId, module: input.module, entity_type: input.entityType, entity_id: input.entityId ?? null, action: input.action, old_data: payload.old_data, new_data: payload.new_data });
  if (auditError?.code === "23505") {
    await serverSupabase.from("database_audit_outbox").update({ status: "delivered", delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", outboxId);
    return { status: "delivered" as const, outboxId };
  }
  if (!auditError) {
    await serverSupabase.from("database_audit_outbox").update({ status: "delivered", delivered_at: new Date().toISOString(), updated_at: new Date().toISOString(), attempt_count: 1 }).eq("id", outboxId);
    return { status: "delivered" as const, outboxId };
  }
  await serverSupabase.from("database_audit_outbox").update({ status: "pending", last_error: "audit_delivery_failed", next_attempt_at: new Date(Date.now() + 30_000).toISOString(), attempt_count: 1, updated_at: new Date().toISOString() }).eq("id", outboxId);
  return { status: "pending" as const, outboxId };
}

export async function retryPendingAudits(limit = 25) {
  const { data: rows, error } = await serverSupabase.from("database_audit_outbox").select("id,idempotency_key,actor_id,module,entity_type,entity_id,action,payload,attempt_count").eq("status", "pending").lte("next_attempt_at", new Date().toISOString()).lt("attempt_count", 10).order("created_at").limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw new Error("audit_outbox_unavailable");
  let delivered = 0;
  for (const row of rows ?? []) {
    const { error: auditError } = await serverSupabase.from("audit_logs").insert({ idempotency_key: row.idempotency_key, actor_id: row.actor_id, module: row.module, entity_type: row.entity_type, entity_id: row.entity_id, action: row.action, old_data: row.payload?.old_data ?? null, new_data: row.payload?.new_data ?? null });
    const attempt = row.attempt_count + 1;
    if (!auditError || auditError.code === "23505") {
      await serverSupabase.from("database_audit_outbox").update({ status: "delivered", delivered_at: new Date().toISOString(), updated_at: new Date().toISOString(), attempt_count: attempt, last_error: null }).eq("id", row.id);
      delivered += 1;
    } else {
      await serverSupabase.from("database_audit_outbox").update({ status: attempt >= 10 ? "failed" : "pending", attempt_count: attempt, last_error: "audit_delivery_failed", next_attempt_at: new Date(Date.now() + Math.min(15 * 60_000, 2 ** attempt * 1_000)).toISOString(), updated_at: new Date().toISOString() }).eq("id", row.id);
    }
  }
  return { scanned: rows?.length ?? 0, delivered };
}

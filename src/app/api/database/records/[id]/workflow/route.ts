import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { logServerAudit } from "@/lib/serverAudit";
import { transitionDatabaseRecord, type DatabaseRecordWorkflowAction } from "@/lib/databaseManagement/repository";
import { workflowHttpStatus } from "@/lib/databaseManagement/workflowErrors.mjs";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isSameOriginRequest())) return json({ error: "invalid_origin" }, 403);
  const actor = await getSessionUser();
  if (!actor) return json({ error: "unauthenticated" }, 401);
  const body = await request.json().catch(() => null) as { action?: unknown; reason?: unknown } | null;
  const action = body?.action;
  if (action !== "submit" && action !== "approve" && action !== "return") return json({ error: "invalid_request" }, 400);
  try {
    const id = (await context.params).id;
    const result = await transitionDatabaseRecord(actor, id, action as DatabaseRecordWorkflowAction, typeof body?.reason === "string" ? body.reason : undefined);
    const auditStatus = result.replayed
      ? "replayed"
      : await logServerAudit({ actorId: actor.id, module: "database", entityType: "db_records", entityId: id, action: result.action, idempotencyKey: `record-workflow:${id}:${result.action}:${result.status}`, newData: { status: result.status, reason: result.reason } });
    return json({ result, audit_status: auditStatus });
  } catch (error) {
    const message = error instanceof Error ? error.message : "workflow_failed";
    const status = workflowHttpStatus(message);
    return json({ error: message }, status);
  }
}

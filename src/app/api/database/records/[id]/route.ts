import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { logServerAudit } from "@/lib/serverAudit";
import { getVisibleDatabaseRecord, setDatabaseRecordStatus, updateDatabaseRecord } from "@/lib/databaseManagement/repository";
import { validateDatabaseRecordUpdateInput } from "@/lib/databaseManagement/validation";

const NO_STORE = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });
const errorStatus = (message: string) => message === "permission_denied" ? 403 : message === "record_not_found" ? 404 : 400;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getSessionUser();
  if (!actor) return json({ error: "unauthenticated" }, 401);
  try {
    const record = await getVisibleDatabaseRecord(actor, (await context.params).id);
    return record ? json({ record }) : json({ error: "not_found" }, 404);
  } catch { return json({ error: "record_read_failed" }, 500); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isSameOriginRequest())) return json({ error: "invalid_origin" }, 403);
  const actor = await getSessionUser();
  if (!actor) return json({ error: "unauthenticated" }, 401);
  const body = await request.json().catch(() => null);
  const validated = validateDatabaseRecordUpdateInput(body);
  if (!validated.ok) return json({ error: "invalid_request", fields: validated.errors }, 400);
  try {
    const record = await updateDatabaseRecord(actor, (await context.params).id, validated.value);
    await logServerAudit({ actorId: actor.id, module: "database", entityType: "db_records", entityId: record.id, action: "update", newData: record });
    return json({ record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "record_update_failed";
    return json({ error: message === "permission_denied" ? "forbidden" : message === "record_not_found" ? "not_found" : message.startsWith("invalid_metadata:") ? "invalid_request" : "record_update_failed" }, errorStatus(message));
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isSameOriginRequest())) return json({ error: "invalid_origin" }, 403);
  const actor = await getSessionUser();
  if (!actor) return json({ error: "unauthenticated" }, 401);
  try {
    const result = await setDatabaseRecordStatus(actor, (await context.params).id, "deleted");
    await logServerAudit({ actorId: actor.id, module: "database", entityType: "db_records", entityId: (await context.params).id, action: "soft_delete" });
    return json({ record: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "record_delete_failed";
    return json({ error: message === "permission_denied" ? "forbidden" : message === "record_not_found" ? "not_found" : "record_delete_failed" }, errorStatus(message));
  }
}

import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { logServerAudit } from "@/lib/serverAudit";
import { createDatabaseRecord, listVisibleDatabaseRecords } from "@/lib/databaseManagement/repository";
import { validateDatabaseRecordInput } from "@/lib/databaseManagement/validation";

const NO_STORE = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export async function GET(request: Request) {
  const actor = await getSessionUser();
  if (!actor) return json({ error: "unauthenticated" }, 401);
  try {
    const params = new URL(request.url).searchParams;
    return json({ records: await listVisibleDatabaseRecords(actor, {
      q: params.get("q") ?? "",
      status: params.get("status") ?? undefined,
      recordTypeId: params.get("recordTypeId") ?? undefined,
      categoryId: params.get("categoryId") ?? undefined,
      limit: Number(params.get("limit") ?? 200),
    }) });
  } catch {
    return json({ error: "record_read_failed" }, 500);
  }
}

export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) return json({ error: "invalid_origin" }, 403);
  const actor = await getSessionUser();
  if (!actor) return json({ error: "unauthenticated" }, 401);
  const body = await request.json().catch(() => null);
  const validated = validateDatabaseRecordInput(body);
  if (!validated.ok) return json({ error: "invalid_request", fields: validated.errors }, 400);
  try {
    const record = await createDatabaseRecord(actor, validated.value);
    await logServerAudit({ actorId: actor.id, module: "database", entityType: "db_records", entityId: record.id, action: "create", newData: { record_code: record.record_code, record_type_id: record.record_type_id } });
    return json({ record }, 201);
  } catch (error) {
    if (error instanceof Error && ["permission_denied", "record_scope_forbidden", "record_type_restricted"].includes(error.message)) return json({ error: "forbidden" }, 403);
    if (error instanceof Error && ["department_required"].includes(error.message) || error instanceof Error && error.message.startsWith("invalid_metadata:")) return json({ error: "invalid_request" }, 400);
    return json({ error: "record_create_failed" }, 500);
  }
}

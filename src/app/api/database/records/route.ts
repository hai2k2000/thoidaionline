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
    const query = {
      q: params.get("q") ?? "",
      status: params.get("status") ?? undefined,
      recordTypeId: params.get("recordTypeId") ?? undefined,
      categoryId: params.get("categoryId") ?? undefined,
      languageCode: params.get("languageCode") ?? undefined,
      limit: Number(params.get("limit") ?? 200),
      offset: Number(params.get("offset") ?? 0),
    };
    const records = await listVisibleDatabaseRecords(actor, query);
    const stats = params.get("includeStats") === "1"
      ? Object.fromEntries(await Promise.all(["all", "draft", "pending_review", "archived"].map(async (status) => {
      const scoped = await listVisibleDatabaseRecords(actor, { categoryId: query.categoryId, languageCode: query.languageCode, limit: 1, status: status === "all" ? undefined : status });
        return [status, Number(scoped[0]?.total_count ?? 0)];
      })))
      : undefined;
    return json({ records, ...(stats ? { stats } : {}) });
  } catch {
    return json({ error: "record_read_failed" }, 500);
  }
}

export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) return json({ error: "invalid_origin" }, 403);
  const actor = await getSessionUser();
  if (!actor) return json({ error: "unauthenticated" }, 401);
  const clientRequestId = request.headers.get("Idempotency-Key")?.trim() ?? "";
  if (clientRequestId && !/^[a-zA-Z0-9_-]{8,200}$/.test(clientRequestId)) return json({ error: "invalid_idempotency_key" }, 400);
  const body = await request.json().catch(() => null);
  const validated = validateDatabaseRecordInput(body);
  if (!validated.ok) return json({ error: "invalid_request", fields: validated.errors }, 400);
  try {
    const record = await createDatabaseRecord(actor, validated.value, clientRequestId || undefined);
    await logServerAudit({ actorId: actor.id, module: "database", entityType: "db_records", entityId: record.id, action: "create", idempotencyKey: clientRequestId || `record-create:${record.id}`, newData: { record_code: record.record_code, record_type_id: record.record_type_id } });
    return json({ record }, 201);
  } catch (error) {
    if (error instanceof Error && ["permission_denied", "record_scope_forbidden", "record_type_restricted"].includes(error.message)) return json({ error: "forbidden" }, 403);
    if (error instanceof Error && error.message === "department_required") return json({ error: "invalid_request", fields: [{ field: "department", code: "required" }] }, 400);
    if (error instanceof Error && error.message === "language_required") return json({ error: "invalid_request", fields: [{ field: "languageCode", code: "required" }] }, 400);
    if (error instanceof Error && error.message.startsWith("invalid_metadata:")) {
      let fields: unknown[] = [];
      try { fields = JSON.parse(error.message.slice("invalid_metadata:".length)) as unknown[]; } catch { fields = []; }
      return json({ error: "invalid_request", fields }, 400);
    }
    return json({ error: "record_create_failed" }, 500);
  }
}

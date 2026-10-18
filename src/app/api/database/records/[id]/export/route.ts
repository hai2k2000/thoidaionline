import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/serverSession";
import { canAccessDatabaseRecordForActor, getVisibleDatabaseRecord } from "@/lib/databaseManagement/repository";
import { logServerAudit } from "@/lib/serverAudit";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getSessionUser();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const id = (await context.params).id;
  if (!(await canAccessDatabaseRecordForActor(actor, id, "export"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const detail = await getVisibleDatabaseRecord(actor, id);
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });
  let auditStatus: "delivered" | "pending";
  try { auditStatus = await logServerAudit({ actorId: actor.id, module: "database", entityType: "db_records", entityId: id, action: "export" }); } catch { return NextResponse.json({ error: "audit_unavailable" }, { status: 503 }); }
  return new NextResponse(JSON.stringify({ record: detail.record, keywords: detail.keywords, externalLinks: detail.externalLinks }, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="database-record-${id}.json"`, "Cache-Control": "private, no-store", "X-Audit-Status": auditStatus },
  });
}

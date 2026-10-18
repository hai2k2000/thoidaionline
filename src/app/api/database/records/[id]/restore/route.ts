import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { setDatabaseRecordStatus } from "@/lib/databaseManagement/repository";
import { logServerAudit } from "@/lib/serverAudit";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isSameOriginRequest())) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const actor = await getSessionUser();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try { const id = (await context.params).id; const record = await setDatabaseRecordStatus(actor, id, "draft"); await logServerAudit({ actorId: actor.id, module: "database", entityType: "db_records", entityId: id, action: "restore" }); return NextResponse.json({ record }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { const message = error instanceof Error ? error.message : "restore_failed"; return NextResponse.json({ error: message === "permission_denied" ? "forbidden" : message === "record_not_found" ? "not_found" : "restore_failed" }, { status: message === "permission_denied" ? 403 : message === "record_not_found" ? 404 : 400 }); }
}

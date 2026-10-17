import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { setDatabaseRecordStatus } from "@/lib/databaseManagement/repository";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isSameOriginRequest())) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const actor = await getSessionUser();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try { return NextResponse.json({ record: await setDatabaseRecordStatus(actor, (await context.params).id, "draft") }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { const message = error instanceof Error ? error.message : "restore_failed"; return NextResponse.json({ error: message === "permission_denied" ? "forbidden" : message === "record_not_found" ? "not_found" : "restore_failed" }, { status: message === "permission_denied" ? 403 : message === "record_not_found" ? 404 : 400 }); }
}

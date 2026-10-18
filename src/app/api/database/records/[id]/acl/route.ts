import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { upsertDatabaseRecordAcl } from "@/lib/databaseManagement/repository";
import { validateDatabaseAclInput } from "@/lib/databaseManagement/validation";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isSameOriginRequest())) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const actor = await getSessionUser();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const validated = validateDatabaseAclInput(await request.json().catch(() => null));
  if (!validated.ok) return NextResponse.json({ error: "invalid_request", fields: validated.errors }, { status: 400 });
  try { return NextResponse.json({ acl: await upsertDatabaseRecordAcl(actor, (await context.params).id, validated.value) }, { status: 201, headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { const message = error instanceof Error ? error.message : "acl_update_failed"; return NextResponse.json({ error: message === "permission_denied" ? "forbidden" : message === "record_not_found" ? "not_found" : "acl_update_failed" }, { status: message === "permission_denied" ? 403 : message === "record_not_found" ? 404 : 400 }); }
}

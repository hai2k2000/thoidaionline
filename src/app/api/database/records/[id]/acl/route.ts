import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { getDatabaseRecordAclManagement, upsertDatabaseRecordAcl } from "@/lib/databaseManagement/repository";
import { validateDatabaseAclInput } from "@/lib/databaseManagement/validation";

const NO_STORE = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getSessionUser();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: NO_STORE });
  try {
    const result = await getDatabaseRecordAclManagement(actor, (await context.params).id);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    const message = error instanceof Error ? error.message : "acl_read_failed";
    const status = message === "permission_denied" ? 403 : message === "record_not_found" ? 404 : 500;
    return NextResponse.json({ error: status === 403 ? "forbidden" : status === 404 ? "not_found" : "acl_read_failed" }, { status, headers: NO_STORE });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isSameOriginRequest())) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const actor = await getSessionUser();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const validated = validateDatabaseAclInput(await request.json().catch(() => null));
  if (!validated.ok) return NextResponse.json({ error: "invalid_request", fields: validated.errors }, { status: 400 });
  try { return NextResponse.json({ acl: await upsertDatabaseRecordAcl(actor, (await context.params).id, validated.value) }, { status: 201, headers: NO_STORE }); }
  catch (error) { const message = error instanceof Error ? error.message : "acl_update_failed"; return NextResponse.json({ error: message === "permission_denied" ? "forbidden" : message === "record_not_found" ? "not_found" : "acl_update_failed" }, { status: message === "permission_denied" ? 403 : message === "record_not_found" ? 404 : 400 }); }
}

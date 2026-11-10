import { fileResponseHeaders } from "@/lib/fileResponseHeaders.mjs";
import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { deleteDatabaseRecordFile, getDatabaseRecordFile } from "@/lib/databaseManagement/repository";
import { readDatabaseRecordFile, removeDatabaseRecordFile } from "@/lib/databaseManagement/storage";
import { logServerAudit } from "@/lib/serverAudit";

export async function GET(request: Request, context: { params: Promise<{ id: string; fileId: string }> }) {
  const actor = await getSessionUser();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const { id, fileId } = await context.params;
    const mode = new URL(request.url).searchParams.get("mode") === "preview" ? "preview" : "download";
    const file = await getDatabaseRecordFile(actor, id, fileId, mode);
    const content = await readDatabaseRecordFile(file.storage_key);
    if (content.sha256 !== file.sha256) return NextResponse.json({ error: "file_integrity_failed" }, { status: 500 });
    let auditStatus: "delivered" | "pending";
    try { auditStatus = await logServerAudit({ actorId: actor.id, module: "database", entityType: "db_record_files", entityId: file.id, action: mode, newData: { record_id: file.record_id, size_bytes: content.bytes.length, sha256: content.sha256 } }); } catch { return NextResponse.json({ error: "audit_unavailable" }, { status: 503 }); }
    const headers = fileResponseHeaders({ fileName: file.original_name, mimeType: file.mime_type }, mode === "preview" ? "inline" : "attachment");
    headers.set("Content-Length", String(content.bytes.length));
    headers.set("X-Audit-Status", auditStatus);
    return new NextResponse(new Uint8Array(content.bytes), { headers });
  } catch (error) { const message = error instanceof Error ? error.message : "file_read_failed"; return NextResponse.json({ error: message === "permission_denied" ? "forbidden" : message === "file_not_found" ? "not_found" : "file_read_failed" }, { status: message === "permission_denied" ? 403 : message === "file_not_found" ? 404 : 500 }); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string; fileId: string }> }) {
  if (!(await isSameOriginRequest())) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const actor = await getSessionUser();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const { id, fileId } = await context.params;
    const file = await deleteDatabaseRecordFile(actor, id, fileId);
    try { await removeDatabaseRecordFile(file.storage_key); } catch {}
    try {
      await logServerAudit({ actorId: actor.id, module: "database", entityType: "db_record_files", entityId: file.id, action: "file_delete", newData: { record_id: id, size_bytes: file.size_bytes, sha256: file.sha256 } });
    } catch {
      return NextResponse.json({ error: "audit_reconciliation_required" }, { status: 500, headers: { "X-Audit-Status": "reconciliation_required" } });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "file_delete_failed";
    const status = message === "permission_denied" || message === "record_not_found" ? 403 : message === "file_not_found" ? 404 : message === "record_locked" ? 409 : 500;
    return NextResponse.json({ error: status === 403 ? "forbidden" : message }, { status });
  }
}

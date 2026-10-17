import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/serverSession";
import { getDatabaseRecordFile } from "@/lib/databaseManagement/repository";
import { readDatabaseRecordFile } from "@/lib/databaseManagement/storage";

export async function GET(_request: Request, context: { params: Promise<{ id: string; fileId: string }> }) {
  const actor = await getSessionUser();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const { id, fileId } = await context.params;
    const file = await getDatabaseRecordFile(actor, id, fileId);
    const content = await readDatabaseRecordFile(file.storage_key);
    if (content.sha256 !== file.sha256) return NextResponse.json({ error: "file_integrity_failed" }, { status: 500 });
    return new NextResponse(new Uint8Array(content.bytes), { headers: { "Content-Type": file.mime_type, "Content-Length": String(content.bytes.length), "Content-Disposition": `attachment; filename="${file.original_name.replace(/[\"\r\n]/g, "_")}"`, "Cache-Control": "private, no-store" } });
  } catch (error) { const message = error instanceof Error ? error.message : "file_read_failed"; return NextResponse.json({ error: message === "permission_denied" ? "forbidden" : message === "file_not_found" ? "not_found" : "file_read_failed" }, { status: message === "permission_denied" ? 403 : message === "file_not_found" ? 404 : 500 }); }
}

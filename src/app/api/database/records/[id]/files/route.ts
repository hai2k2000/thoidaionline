import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { canAccessDatabaseRecordForActor } from "@/lib/databaseManagement/repository";
import { removeDatabaseRecordFile, writeDatabaseRecordFile } from "@/lib/databaseManagement/storage";

const MAX_MULTIPART_BYTES = 51 * 1024 * 1024;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isSameOriginRequest())) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const actor = await getSessionUser();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_MULTIPART_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  const recordId = (await context.params).id;
  if (!(await canAccessDatabaseRecordForActor(actor, recordId, "edit"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file_required" }, { status: 400 });
  let storageKey: string | null = null;
  try {
    const stored = await writeDatabaseRecordFile(recordId, file);
    storageKey = stored.storageKey;
    const { data, error } = await serverSupabase.from("db_record_files").insert({ record_id: recordId, storage_backend: "vps_private", storage_key: stored.storageKey, original_name: file.name, mime_type: file.type, size_bytes: stored.sizeBytes, sha256: stored.sha256, created_by: actor.id }).select("id,original_name,mime_type,size_bytes,sha256,created_at").single();
    if (error) throw error;
    const { error: historyError } = await serverSupabase.from("db_record_history").insert({ record_id: recordId, actor_id: actor.id, action: "file_upload", old_data: null, new_data: { file_id: data.id, original_name: file.name, size_bytes: stored.sizeBytes, sha256: stored.sha256 } });
    if (historyError) {
      await serverSupabase.from("db_record_files").delete().eq("id", data.id);
      throw historyError;
    }
    return NextResponse.json({ file: data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (storageKey) await removeDatabaseRecordFile(storageKey).catch(() => undefined);
    return NextResponse.json({ error: error instanceof Error && error.message === "invalid_file" ? "invalid_file" : "file_upload_failed" }, { status: 400 });
  }
}

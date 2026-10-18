import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { canAccessDatabaseRecordForActor } from "@/lib/databaseManagement/repository";
import { removeDatabaseRecordFile, writeDatabaseRecordFile } from "@/lib/databaseManagement/storage";

const MAX_MULTIPART_BYTES = 51 * 1024 * 1024;

function boundedBody(body: ReadableStream<Uint8Array>, limit: number) {
  const reader = body.getReader();
  let seen = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) return controller.close();
        seen += value.byteLength;
        if (seen > limit) {
          await reader.cancel("body_too_large");
          return controller.error(new Error("file_too_large"));
        }
        controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel(reason) { await reader.cancel(reason); },
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isSameOriginRequest())) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const actor = await getSessionUser();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const contentLengthHeader = request.headers.get("content-length");
  const contentLength = contentLengthHeader === null ? null : /^\d+$/.test(contentLengthHeader.trim()) ? Number(contentLengthHeader) : NaN;
  if (contentLength !== null && (!Number.isSafeInteger(contentLength) || contentLength < 0)) return NextResponse.json({ error: "invalid_content_length" }, { status: 400 });
  if (contentLength !== null && Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  const recordId = (await context.params).id;
  if (!(await canAccessDatabaseRecordForActor(actor, recordId, "edit"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let form: FormData;
  try {
    const body = request.body ? boundedBody(request.body, MAX_MULTIPART_BYTES) : null;
    const boundedRequest = body ? new Request(request.url, { method: request.method, headers: request.headers, body, duplex: "half" } as RequestInit) : request;
    form = await boundedRequest.formData();
  } catch (error) {
    if (error instanceof Error && error.message === "file_too_large") return NextResponse.json({ error: "file_too_large" }, { status: 413 });
    return NextResponse.json({ error: "invalid_multipart" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file_required" }, { status: 400 });
  let storageKey: string | null = null;
  let retainStorageForReconciliation = false;
  try {
    const stored = await writeDatabaseRecordFile(recordId, file);
    storageKey = stored.storageKey;
    const { data, error } = await serverSupabase.from("db_record_files").insert({ record_id: recordId, storage_backend: "vps_private", storage_key: stored.storageKey, original_name: file.name, mime_type: file.type, size_bytes: stored.sizeBytes, sha256: stored.sha256, created_by: actor.id }).select("id,original_name,mime_type,size_bytes,sha256,created_at").single();
    if (error) throw error;
    const { error: historyError } = await serverSupabase.from("db_record_history").insert({ record_id: recordId, actor_id: actor.id, action: "file_upload", old_data: null, new_data: { file_id: data.id, original_name: file.name, size_bytes: stored.sizeBytes, sha256: stored.sha256 } });
    if (historyError) {
      const { error: compensationError } = await serverSupabase.from("db_record_files").delete().eq("id", data.id);
      if (compensationError) {
        retainStorageForReconciliation = true;
        throw new Error("file_upload_reconciliation_required");
      }
      throw historyError;
    }
    return NextResponse.json({ file: data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (storageKey && !retainStorageForReconciliation) await removeDatabaseRecordFile(storageKey).catch(() => undefined);
    const message = error instanceof Error ? error.message : "file_upload_failed";
    if (message === "file_upload_reconciliation_required") return NextResponse.json({ error: message }, { status: 500 });
    return NextResponse.json({ error: message === "invalid_file" ? "invalid_file" : "file_upload_failed" }, { status: 400 });
  }
}

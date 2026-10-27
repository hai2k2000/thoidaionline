export const MAX_RECORD_FILE_BYTES = 50 * 1024 * 1024;
export const RECORD_FILE_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export function validateSelectedFiles(files) {
  return files.flatMap((file, index) => [
    !RECORD_FILE_TYPES.has(file.type) ? { index, code: "invalid_type" } : null,
    file.size <= 0 || file.size > MAX_RECORD_FILE_BYTES ? { index, code: "file_too_large" } : null,
  ].filter(Boolean));
}

function normalizeUpload(item, index) {
  return item instanceof File ? { file: item, uploadId: crypto.randomUUID?.() ?? `upload-${index}-${Date.now()}` } : item;
}

export async function uploadRecordFiles(recordId, files, fetchImpl = fetch, options = {}) {
  const failed = [];
  const unknown = [];
  const timeoutMs = options.timeoutMs ?? 30_000;
  for (const file of files) {
    const item = normalizeUpload(file, files.indexOf(file));
    const validation = validateSelectedFiles([item.file]);
    if (validation.length) {
      failed.push({ file: item.file, uploadId: item.uploadId, code: validation[0].code });
      continue;
    }
    const body = new FormData();
    body.set("file", item.file);
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const response = await fetchImpl(`/api/database/records/${recordId}/files`, { method: "POST", body, signal: controller?.signal, headers: { "Idempotency-Key": item.uploadId } });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const result = { file: item.file, uploadId: item.uploadId, code: payload?.error ?? "file_upload_failed" };
        if (response.status >= 500) unknown.push({ ...result, code: "upload_result_unknown" }); else failed.push(result);
      }
    } catch (error) {
      unknown.push({ file: item.file, uploadId: item.uploadId, code: error?.name === "AbortError" ? "upload_result_unknown" : "upload_result_unknown" });
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
  return { failed, unknown };
}

export async function reconcileRecordFile(recordId, uploadId, fetchImpl = fetch) {
  const response = await fetchImpl(`/api/database/records/${recordId}/files?upload_request_id=${encodeURIComponent(uploadId)}`, { headers: { "Idempotency-Key": uploadId } });
  const payload = await response.json().catch(() => null);
  return response.ok && payload?.file ? { file: payload.file } : { file: null, code: payload?.error ?? "file_not_found" };
}

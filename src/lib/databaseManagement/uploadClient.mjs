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

export async function uploadRecordFiles(recordId, files, fetchImpl = fetch) {
  const failed = [];
  for (const file of files) {
    const body = new FormData();
    body.set("file", file);
    try {
      const response = await fetchImpl(`/api/database/records/${recordId}/files`, { method: "POST", body });
      if (!response.ok) failed.push({ file, code: (await response.json().catch(() => null))?.error ?? "file_upload_failed" });
    } catch {
      failed.push({ file, code: "file_upload_failed" });
    }
  }
  return { failed };
}

import { fileResponseHeaders } from "./fileResponseHeaders.mjs";

export function taskAttachmentHeaders(attachment, disposition = "inline") {
  const headers = fileResponseHeaders({ fileName: attachment.file_name, mimeType: attachment.mime_type }, disposition);
  headers.set("Accept-Ranges", "bytes");
  return headers;
}

// Ignore malformed/multipart ranges; reject a valid but unsatisfiable single range.
export function taskAttachmentRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value || "");
  if (!match || (!match[1] && !match[2])) return null;
  const first = match[1] ? Number(match[1]) : null;
  const last = match[2] ? Number(match[2]) : null;
  if ((first !== null && !Number.isSafeInteger(first)) || (last !== null && !Number.isSafeInteger(last))) return false;
  const start = first ?? Math.max(0, size - (last ?? 0));
  const end = first === null ? size - 1 : Math.min(last ?? size - 1, size - 1);
  return start > end || start >= size ? false : { start, end };
}

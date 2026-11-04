const inlineTypes = new Set([
  "application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp", "image/avif",
  "video/mp4", "video/webm", "video/ogg", "video/quicktime", "text/plain", "text/csv",
]);

export function taskAttachmentHeaders(attachment) {
  const storedMime = (attachment.mime_type || "application/octet-stream").trim();
  const mime = storedMime.split(";", 1)[0].trim().toLowerCase();
  const unsafe = /(?:html|svg|javascript|ecmascript)|(?:\/|\+)xml$/.test(mime);
  const inline = !unsafe && (inlineTypes.has(mime) || mime.startsWith("audio/"));
  const name = (attachment.file_name || "download").replace(/[\r\n\x00-\x1f\x7f/\\]/g, "_").toWellFormed();
  const fallback = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]|["\\]/g, "_");
  const encoded = encodeURIComponent(name).replace(/['()*!]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  const headers = new Headers({
    "Content-Type": unsafe ? "application/octet-stream" : storedMime,
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fallback}"; filename*=UTF-8''${encoded}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  });
  if (inline) headers.set("Content-Security-Policy", mime === "application/pdf" ? "default-src 'none'" : "default-src 'none'; sandbox");
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

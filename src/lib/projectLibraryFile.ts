type FileMetadata = { mime_type: string | null; file_name: string | null; title: string };
const inlineTypes = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
  'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/x-m4a',
  'text/plain', 'text/csv',
]);
const extensionTypes: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', avif: 'image/avif', mp4: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg',
  mov: 'video/quicktime', mp3: 'audio/mpeg', m4a: 'audio/x-m4a', aac: 'audio/aac', ogg: 'audio/ogg',
  wav: 'audio/wav', txt: 'text/plain', csv: 'text/csv',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
export function libraryFileMime(item: FileMetadata): string {
  const stored = (item.mime_type || '').split(';')[0].trim().toLowerCase();
  return stored || extensionTypes[(item.file_name || item.title).split('.').pop()?.toLowerCase() || ''] || 'application/octet-stream';
}
export function libraryOfficeKind(item: FileMetadata): 'docx' | 'xlsx' | null {
  const mime = libraryFileMime(item);
  if (mime === extensionTypes.docx) return 'docx';
  if (mime === extensionTypes.xlsx) return 'xlsx';
  const extension = (item.file_name || item.title).split('.').pop()?.toLowerCase();
  return extension === 'docx' || extension === 'xlsx' ? extension : null;
}
export function libraryPreviewMime(item: FileMetadata): string | null {
  const office = libraryOfficeKind(item);
  if (office) return extensionTypes[office];
  const mime = libraryFileMime(item);
  return inlineTypes.has(mime) ? mime : null;
}
export function libraryFileHeaders(item: FileMetadata, requestedDisposition: string): Headers {
  const mime = libraryFileMime(item);
  const inline = requestedDisposition === 'inline' && inlineTypes.has(mime);
  const name = item.file_name || item.title || 'download';
  const fallback = Array.from(name, c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126 && !['"', '\\'].includes(c) ? c : '_').join('');
  const encoded = encodeURIComponent(name).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  const headers = new Headers({
    'Content-Type': /html|svg|xml|javascript|ecmascript/.test(mime) && !mime.includes('openxmlformats') ? 'application/octet-stream' : mime,
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${fallback}"; filename*=UTF-8''${encoded}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  });
  // Chrome's built-in PDF viewer cannot run under CSP sandbox; omit CSP only for PDF.
  if (inline && mime !== 'application/pdf') headers.set('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox");
  return headers;
}
export async function readLibraryText(response: Response): Promise<string> {
  if (!response.ok || !response.body) throw new Error('preview_unavailable');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let remaining = 2 * 1024 * 1024;
  let text = '';
  try {
    while (remaining > 0) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, remaining);
      text += decoder.decode(chunk, { stream: true });
      remaining -= chunk.byteLength;
    }
    return text + decoder.decode();
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

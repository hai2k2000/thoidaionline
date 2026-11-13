import { legacyOfficeMime, LEGACY_OFFICE_MIME_TYPES } from './legacyOffice.mjs';

const extensionKinds = {
  pdf: 'pdf', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', avif: 'image',
  mp4: 'video', webm: 'video', ogv: 'video', mov: 'video',
  mp3: 'audio', m4a: 'audio', aac: 'audio', ogg: 'audio', wav: 'audio', flac: 'audio', opus: 'audio',
  txt: 'text', csv: 'csv', docx: 'docx', xlsx: 'xlsx',
};
/** @param {{ fileName?: string, mimeType?: string | null }} file */
export function filePreviewKind({ fileName = '', mimeType = '' }) {
  const mime = (mimeType || '').split(';')[0].trim().toLowerCase();
  const extension = fileName.split('.').pop().toLowerCase();
  if (legacyOfficeMime(fileName) || Object.values(LEGACY_OFFICE_MIME_TYPES).includes(mime)) return null;
  if (/html|svg|javascript|ecmascript|(?:\/|\+)xml$/.test(mime) || /^(html?|svg|xml|m?js|xhtml)$/.test(extension)) return null;
  if (mime === 'application/pdf') return 'pdf';
  if (/^image\/(png|jpeg|gif|webp|avif)$/.test(mime)) return 'image';
  if (/^video\/(mp4|webm|ogg|quicktime)$/.test(mime)) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'text/plain') return 'text';
  if (mime === 'text/csv') return 'csv';
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
  return extensionKinds[extension] ?? null;
}

export function parsePreviewCsv(text, maxRows = 1000, maxCols = 50) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  const pushCell = () => { if (row.length < maxCols) row.push(cell); cell = ''; };
  for (let i = 0; i < text.length && rows.length < maxRows; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && c === ',') pushCell();
    else if (!quoted && (c === '\n' || c === '\r')) {
      pushCell(); rows.push(row); row = [];
      if (c === '\r' && text[i + 1] === '\n') i++;
    } else if (row.length < maxCols) cell += c;
  }
  if (rows.length < maxRows && (cell || row.length)) { pushCell(); rows.push(row); }
  return rows;
}

export async function readPreviewBytes(response, maxBytes, truncate = false) {
  if (!response.ok || !response.body) throw new Error('preview_unavailable');
  const reader = response.body.getReader(); const chunks = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (length + value.length > maxBytes && !truncate) throw new Error('large');
      const chunk = value.subarray(0, maxBytes - length);
      chunks.push(chunk); length += chunk.length;
      if (truncate && length === maxBytes) break;
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes.buffer;
}

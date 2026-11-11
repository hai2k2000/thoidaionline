import { contentDisposition } from './contentDisposition.mjs';

const inlineTypes = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'text/plain', 'text/csv',
]);
const extensionTypes = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  mp4: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', wav: 'audio/wav', flac: 'audio/flac', opus: 'audio/ogg',
  txt: 'text/plain', csv: 'text/csv',
};

export function fileResponseHeaders({ fileName, mimeType }, disposition = 'attachment') {
  let mime = (mimeType || 'application/octet-stream').split(';', 1)[0].trim().toLowerCase();
  if (disposition === 'inline' && mime === 'application/octet-stream') {
    mime = extensionTypes[(fileName || '').split('.').pop().toLowerCase()] ?? mime;
  }
  const unsafe = /(?:html|svg|javascript|ecmascript)|(?:\/|\+)xml$/.test(mime)
    || /\.(?:html?|svg|xml|m?js|xhtml)$/i.test(fileName || '');
  const inline = disposition === 'inline' && !unsafe && (inlineTypes.has(mime) || mime.startsWith('audio/'));
  const headers = new Headers({
    'Content-Type': unsafe ? 'application/octet-stream' : mime,
    'Content-Disposition': contentDisposition(fileName, { inline }),
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  // Preserve the task PDF exception: browser PDF plugins cannot run in a CSP sandbox.
  if (inline) headers.set('Content-Security-Policy', mime === 'application/pdf' ? "default-src 'none'" : "default-src 'none'; sandbox");
  return headers;
}

export const LEGACY_OFFICE_MIME_TYPES = Object.freeze({
  doc: 'application/msword',
  xls: 'application/vnd.ms-excel',
  ppt: 'application/vnd.ms-powerpoint',
});
const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export function fileExtension(name) {
  return /\.([a-z0-9]+)$/i.exec(name.trim())?.[1].toLowerCase() ?? '';
}

export function legacyOfficeMime(name) {
  const extension = fileExtension(name);
  return Object.hasOwn(LEGACY_OFFICE_MIME_TYPES, extension) ? LEGACY_OFFICE_MIME_TYPES[extension] : null;
}

export function hasOle2Magic(bytes) {
  return Boolean(bytes && OLE2_MAGIC.every((value, index) => bytes[index] === value));
}

export async function hasLegacyOfficeFileMagic(file) {
  if (!legacyOfficeMime(file.name)) return false;
  try { return hasOle2Magic(new Uint8Array(await file.slice(0, 8).arrayBuffer())); }
  catch { return false; }
}

export function uploadFormatMessage(extensions, maxBytes) {
  const formats = extensions.map(extension => extension.replace(/^\./, '').toUpperCase()).join(', ');
  return `Định dạng không được hỗ trợ. Chấp nhận: ${formats} (tối đa ${maxBytes / 1024 / 1024} MB).`;
}

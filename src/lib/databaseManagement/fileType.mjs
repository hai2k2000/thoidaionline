import { LEGACY_OFFICE_MIME_TYPES, legacyOfficeMime, hasOle2Magic, uploadFormatMessage } from '../legacyOffice.mjs';

export const DATABASE_RECORD_FILE_TYPES = new Map([
  [".pdf", "application/pdf"],
  [".doc", LEGACY_OFFICE_MIME_TYPES.doc],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".xls", LEGACY_OFFICE_MIME_TYPES.xls],
  [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
]);
export const DATABASE_RECORD_FILE_ACCEPT = [...DATABASE_RECORD_FILE_TYPES.keys()].join(',');
export const DATABASE_RECORD_FORMAT_MESSAGE = uploadFormatMessage([...DATABASE_RECORD_FILE_TYPES.keys()], 150 * 1024 * 1024);

export function databaseRecordFileType(name) {
  const match = /\.[^.]+$/.exec(name.trim().toLowerCase());
  return match ? DATABASE_RECORD_FILE_TYPES.get(match[0]) ?? null : null;
}

export function hasDatabaseRecordFileMagic(name, bytes) {
  const extension = /\.[^.]+$/.exec(name.trim().toLowerCase())?.[0];
  const prefix = Array.from(bytes.slice(0, 8));
  if (extension === ".pdf") return String.fromCharCode(...prefix.slice(0, 5)) === "%PDF-";
  if (extension === ".docx" || extension === ".xlsx") return prefix.slice(0, 4).join(",") === "80,75,3,4";
  if (DATABASE_RECORD_FILE_TYPES.has(extension) && legacyOfficeMime(name)) return hasOle2Magic(bytes);
  return false;
}

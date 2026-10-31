export const DATABASE_RECORD_FILE_TYPES = new Map([
  [".pdf", "application/pdf"],
  [".doc", "application/msword"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".xls", "application/vnd.ms-excel"],
  [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
]);

export function databaseRecordFileType(name) {
  const match = /\.[^.]+$/.exec(name.trim().toLowerCase());
  return match ? DATABASE_RECORD_FILE_TYPES.get(match[0]) ?? null : null;
}

export function hasDatabaseRecordFileMagic(name, bytes) {
  const extension = /\.[^.]+$/.exec(name.trim().toLowerCase())?.[0];
  const prefix = Array.from(bytes.slice(0, 8));
  if (extension === ".pdf") return String.fromCharCode(...prefix.slice(0, 5)) === "%PDF-";
  if (extension === ".docx" || extension === ".xlsx") return prefix.slice(0, 4).join(",") === "80,75,3,4";
  if (extension === ".doc" || extension === ".xls") return prefix.join(",") === "208,207,17,224,161,177,26,225";
  return false;
}
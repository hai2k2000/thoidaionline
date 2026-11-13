import { fileExtension, legacyOfficeMime, hasOle2Magic, hasLegacyOfficeFileMagic, LEGACY_OFFICE_MIME_TYPES, uploadFormatMessage } from './legacyOffice.mjs';

export const TASK_ATTACHMENT_MAX_BYTES = 10485760;
const mimeByExtension = {
 pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',
 doc:LEGACY_OFFICE_MIME_TYPES.doc,
 docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 xls:LEGACY_OFFICE_MIME_TYPES.xls,
 xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
export const TASK_ATTACHMENT_ACCEPT = Object.keys(mimeByExtension).map(extension => `.${extension}`).join(',');
export const TASK_ATTACHMENT_FORMAT_MESSAGE = uploadFormatMessage(Object.keys(mimeByExtension), TASK_ATTACHMENT_MAX_BYTES);
export function taskAttachmentMetadata(file, bytes) {
 const extension=fileExtension(file.name);
 const mimeType=Object.hasOwn(mimeByExtension,extension) ? mimeByExtension[extension] : null;
 if(file.size<1||file.size>TASK_ATTACHMENT_MAX_BYTES||!mimeType)return null;
 if(legacyOfficeMime(file.name) && !hasOle2Magic(bytes))return null;
 return {mimeType,extension};
}
export async function readTaskAttachmentMetadata(file) {
 if (file.size < 1 || file.size > TASK_ATTACHMENT_MAX_BYTES || !Object.hasOwn(mimeByExtension, fileExtension(file.name))) return null;
 if (!legacyOfficeMime(file.name)) return taskAttachmentMetadata(file);
 if (!await hasLegacyOfficeFileMagic(file)) return null;
 return { mimeType: legacyOfficeMime(file.name), extension: fileExtension(file.name) };
}
export async function validateTaskAttachment(file) {
 if (file.size < 1) return `Tệp rỗng. ${TASK_ATTACHMENT_FORMAT_MESSAGE}`;
 if (file.size > TASK_ATTACHMENT_MAX_BYTES) return `Tệp vượt quá dung lượng. ${TASK_ATTACHMENT_FORMAT_MESSAGE}`;
 if (!await readTaskAttachmentMetadata(file)) return TASK_ATTACHMENT_FORMAT_MESSAGE;
 return null;
}

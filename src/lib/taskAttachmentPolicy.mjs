export const TASK_ATTACHMENT_MAX_BYTES = 10485760;
const mimeByExtension = {
 pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',
 docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
export function taskAttachmentMetadata(file) {
 const extension=file.name.split('.').pop()?.toLowerCase()??'';
 const mimeType=Object.values(mimeByExtension).includes(file.type)?file.type:mimeByExtension[extension];
 if(file.size<1||file.size>TASK_ATTACHMENT_MAX_BYTES||!mimeType)return null;
 return {mimeType,extension:/^[a-z0-9]+$/.test(extension)?extension:'bin'};
}

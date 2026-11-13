export const TASK_ATTACHMENT_MAX_BYTES: number;
export const TASK_ATTACHMENT_ACCEPT: string;
export const TASK_ATTACHMENT_FORMAT_MESSAGE: string;
export function taskAttachmentMetadata(file: File, bytes?: Uint8Array): {mimeType: string; extension: string} | null;
export function readTaskAttachmentMetadata(file: File): Promise<{mimeType: string; extension: string} | null>;
export function validateTaskAttachment(file: File): Promise<string | null>;

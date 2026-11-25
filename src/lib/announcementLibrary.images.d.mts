export type AnnouncementImage = { id: string; announcement_id: string; mime_type: string; width: number | null; height: number | null; position: number; created_at?: string };
export function announcementImageType(bytes: Uint8Array): { mimeType: "image/jpeg" | "image/png" | "image/webp"; extension: "jpg" | "png" | "webp" } | null;
export function orderAnnouncementImages<T extends { position: number; created_at?: string }>(rows: readonly T[]): T[];
export const ANNOUNCEMENT_IMAGE_LIMIT: 6;
export const ANNOUNCEMENT_IMAGE_MAX_BYTES: 5242880;
export function announcementImageType(bytes: Uint8Array): { mimeType: "image/jpeg" | "image/png" | "image/webp"; extension: "jpg" | "png" | "webp" } | null;
export function orderAnnouncementImages<T extends { position: number; created_at?: string }>(rows: readonly T[]): T[];

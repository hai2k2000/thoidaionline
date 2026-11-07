export type AnnouncementInput = { title: string; body: string; important: boolean; pinned: boolean; expiresAt: string | null; departmentId: string | null };
export type AnnouncementAccess = { canManage: boolean; departmentId: string | null; managedDepartmentIds: string[] };
export function validateAnnouncementInput(body: unknown): AnnouncementInput | null;
export function canPostAnnouncement(access: AnnouncementAccess, departmentId: string | null): boolean;
export function canViewAnnouncement(access: AnnouncementAccess, row: { department_id: string | null }): boolean;
export function isAnnouncementActive(row: { deleted_at: string | null; expires_at: string | null }, now?: Date): boolean;
export function sortAnnouncements<T extends { pinned: boolean; created_at: string }>(rows: readonly T[]): T[];
export function isSafeLibraryUrl(value: unknown): boolean;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateAnnouncementInput(body) {
  if (!body || typeof body !== "object") return null;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const expiresAt = body.expiresAt == null || body.expiresAt === "" ? null : typeof body.expiresAt === "string" && !Number.isNaN(Date.parse(body.expiresAt)) ? new Date(body.expiresAt).toISOString() : null;
  const departmentId = body.departmentId == null || body.departmentId === "" ? null : typeof body.departmentId === "string" && UUID_RE.test(body.departmentId) ? body.departmentId : undefined;
  if (!title || title.length > 200 || !text || text.length > 10000 || (body.expiresAt != null && !expiresAt) || departmentId === undefined) return null;
  return { title, body: text, important: body.important === true, pinned: body.pinned === true, expiresAt, departmentId };
}
export function canPostAnnouncement({ canManage, managedDepartmentIds }, departmentId) { return departmentId == null ? canManage : canManage || managedDepartmentIds.includes(departmentId); }
export function canViewAnnouncement({ canManage, departmentId, managedDepartmentIds }, row) { return row.department_id == null || canManage || row.department_id === departmentId || managedDepartmentIds.includes(row.department_id); }
export function isAnnouncementActive(row, now = new Date()) { return !row.deleted_at && (!row.expires_at || new Date(row.expires_at).getTime() > now.getTime()); }
export function sortAnnouncements(rows) { return [...rows].sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); }
export function isSafeLibraryUrl(value) { if (typeof value !== "string" || value.length > 2000) return false; try { const url = new URL(value); return url.protocol === "http:" || url.protocol === "https:"; } catch { return false; } }

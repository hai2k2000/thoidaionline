export type AssetQuickFilter = "all" | "in_use" | "unassigned" | "needs_maintenance" | "broken";

export type AssetListPresentationRow = {
  asset_name?: string | null;
  category?: string | null;
  status?: string | null;
  condition_status?: string | null;
  tracking_mode?: string | null;
  currentAssignment?: { assignee_id?: string | null } | null;
  assigned_department_name?: string | null;
  assignee_name?: string | null;
};

export function isAssetUnassigned(row: AssetListPresentationRow) {
  return !row.currentAssignment;
}

export function presentAssetCustody(row: AssetListPresentationRow) {
  if (isAssetUnassigned(row)) return { department: "Chưa xác định phòng", person: "Cần bổ sung sau", unassigned: true };
  if (!row.currentAssignment) return { department: "Không áp dụng", person: "Không áp dụng", unassigned: false };
  return {
    department: row.assigned_department_name ?? "Phòng đã phân công",
    person: row.assignee_name ?? "Tài sản dùng chung",
    unassigned: false,
  };
}

export function filterAssetList<T extends AssetListPresentationRow>(
  rows: T[],
  filters: { name: string; category: string; status: string; quick: AssetQuickFilter; assigneeId?: string },
) {
  const name = filters.name.trim().toLocaleLowerCase("vi");
  const category = filters.category.trim().toLocaleLowerCase("vi");

  return rows.filter((row) => {
    if (name && !(row.asset_name ?? "").toLocaleLowerCase("vi").includes(name)) return false;
    if (category && !(row.category ?? "").toLocaleLowerCase("vi").includes(category)) return false;
    if (filters.status && row.status !== filters.status && row.condition_status !== filters.status) return false;
    if (filters.assigneeId && filters.assigneeId !== "__shared" && filters.assigneeId !== "__unassigned" && (row.currentAssignment?.assignee_id ?? "") !== filters.assigneeId) return false;
    if (filters.assigneeId === "__shared" && (!row.currentAssignment || row.currentAssignment.assignee_id !== null)) return false;
    if (filters.assigneeId === "__unassigned" && row.currentAssignment) return false;
    if (filters.quick === "in_use" && !row.currentAssignment) return false;
    if (filters.quick === "unassigned" && !isAssetUnassigned(row)) return false;
    if (filters.quick === "needs_maintenance" && row.condition_status !== "needs_maintenance") return false;
    if (filters.quick === "broken" && row.condition_status !== "broken") return false;
    return true;
  });
}

export function summarizeAssetList(rows: AssetListPresentationRow[]) {
  const unassigned = rows.filter(isAssetUnassigned).length;
  return { total: rows.length, assigned: rows.length - unassigned, unassigned };
}

export type AssetQuickFilter = "all" | "in_use" | "unassigned" | "lot" | "needs_maintenance" | "broken";
export type AssetUsageState = "assigned" | "unassigned" | "liquidated";

export type EmployeeFilterState = { assigneeId: string; search: string; activeIndex: number; open: boolean };

export type AssetListPresentationRow = {
  asset_name?: string | null;
  category?: string | null;
  status?: string | null;
  condition_status?: string | null;
  tracking_mode?: string | null;
  currentAssignment?: { assignee_id?: string | null; department_id?: string | null } | null;
  assigned_department_name?: string | null;
  assignee_name?: string | null;
};

export function assetUsageState(row: AssetListPresentationRow): AssetUsageState {
  if (row.status === "liquidated") return "liquidated";
  return row.currentAssignment ? "assigned" : "unassigned";
}

export function isAssetUnassigned(row: AssetListPresentationRow) {
  return assetUsageState(row) === "unassigned";
}

export function resetEmployeeFilterState(state: EmployeeFilterState): EmployeeFilterState {
  return { ...state, assigneeId: "", search: "", activeIndex: 0, open: false };
}

export function closeEmployeeFilterState(state: EmployeeFilterState): EmployeeFilterState {
  return { ...state, open: false };
}

export function normalizeVietnamese(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLocaleLowerCase("vi").trim();
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
  filters: { name: string; category: string; status?: string; usageState?: AssetUsageState | ""; conditionStatus?: string; quick: AssetQuickFilter; departmentId?: string; assigneeId?: string },
) {
  const name = normalizeVietnamese(filters.name);
  const category = normalizeVietnamese(filters.category);

  return rows.filter((row) => {
    if (name && !normalizeVietnamese(row.asset_name ?? "").includes(name)) return false;
    if (category && !normalizeVietnamese(row.category ?? "").includes(category)) return false;
    if (filters.usageState && assetUsageState(row) !== filters.usageState) return false;
    if (filters.conditionStatus && row.condition_status !== filters.conditionStatus) return false;
    if (filters.status && !filters.conditionStatus && row.status !== filters.status) return false;
    if (filters.departmentId && row.currentAssignment?.department_id !== filters.departmentId) return false;
    if (filters.assigneeId && filters.assigneeId !== "__shared" && filters.assigneeId !== "__unassigned" && (row.currentAssignment?.assignee_id ?? "") !== filters.assigneeId) return false;
    if (filters.assigneeId === "__shared" && (!row.currentAssignment || row.currentAssignment.assignee_id !== null || (filters.departmentId && row.currentAssignment.department_id !== filters.departmentId))) return false;
    if (filters.assigneeId === "__unassigned" && row.currentAssignment) return false;
    if (filters.quick === "in_use" && assetUsageState(row) !== "assigned") return false;
    if (filters.quick === "unassigned" && !isAssetUnassigned(row)) return false;
    if (filters.quick === "needs_maintenance" && row.condition_status !== "needs_maintenance") return false;
    if (filters.quick === "broken" && row.condition_status !== "broken") return false;
    if (filters.quick === "lot" && row.tracking_mode !== "lot") return false;
    return true;
  });
}

export function summarizeAssetList(rows: AssetListPresentationRow[]) {
  const assigned = rows.filter((row) => assetUsageState(row) === "assigned").length;
  const unassigned = rows.filter((row) => assetUsageState(row) === "unassigned").length;
  const liquidated = rows.filter((row) => assetUsageState(row) === "liquidated").length;
  return { total: rows.length, assigned, unassigned, liquidated };
}

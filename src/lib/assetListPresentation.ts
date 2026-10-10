export type AssetQuickFilter = "all" | "in_use" | "unassigned" | "lot";

export type AssetListPresentationRow = {
  asset_name?: string | null;
  category?: string | null;
  status?: string | null;
  tracking_mode?: string | null;
  currentAssignment?: unknown | null;
};

export function isAssetUnassigned(row: AssetListPresentationRow) {
  return !row.currentAssignment;
}

export function filterAssetList<T extends AssetListPresentationRow>(
  rows: T[],
  filters: { name: string; category: string; status: string; quick: AssetQuickFilter },
) {
  const name = filters.name.trim().toLocaleLowerCase("vi");
  const category = filters.category.trim().toLocaleLowerCase("vi");

  return rows.filter((row) => {
    if (name && !(row.asset_name ?? "").toLocaleLowerCase("vi").includes(name)) return false;
    if (category && !(row.category ?? "").toLocaleLowerCase("vi").includes(category)) return false;
    if (filters.status && row.status !== filters.status) return false;
    if (filters.quick === "in_use" && row.status !== "in_use") return false;
    if (filters.quick === "unassigned" && !isAssetUnassigned(row)) return false;
    if (filters.quick === "lot" && row.tracking_mode !== "lot") return false;
    return true;
  });
}

export function summarizeAssetList(rows: AssetListPresentationRow[]) {
  const unassigned = rows.filter(isAssetUnassigned).length;
  return { total: rows.length, assigned: rows.length - unassigned, unassigned };
}

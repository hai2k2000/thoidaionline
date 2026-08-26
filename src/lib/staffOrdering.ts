/**
 * Shared ordering for staff lists.
 *
 * Keep the hierarchy tied to stable role/title codes rather than translated
 * labels.  The API uses this before returning rows and the client applies it
 * again after filtering so both screens stay consistent.
 */

export type StaffOrderingRecord = {
  id?: string | null;
  full_name?: string | null;
  /** 0 keeps the current hierarchy; a positive value pins the row to bottom. */
  list_order?: number | null;
  role_code?: string | null;
  role_level?: number | null;
  job_title_code?: string | null;
  job_title_display_order?: number | null;
  department_code?: string | null;
  roles?: { code?: string | null; level?: number | null } | Array<{ code?: string | null; level?: number | null }> | null;
  job_titles?: { code?: string | null; display_order?: number | null } | Array<{ code?: string | null; display_order?: number | null }> | null;
  departments?: { code?: string | null } | Array<{ code?: string | null }> | null;
};

const TBT_ROLE_CODES = new Set(["tong_bien_tap", "tbt_read_only"]);

const TBT_TITLE_CODES = new Set(["tong_bien_tap", "tbt_read_only"]);
const DEPUTY_ROLE_CODES = new Set(["pho_tong_bien_tap"]);
const DEPUTY_TITLE_CODES = new Set(["pho_tong_bien_tap"]);

function code(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function roleCode(row: StaffOrderingRecord) {
  return code(row.role_code ?? firstRelation(row.roles)?.code);
}

function jobTitleCode(row: StaffOrderingRecord) {
  return code(row.job_title_code ?? firstRelation(row.job_titles)?.code);
}

function departmentCode(row: StaffOrderingRecord) {
  return code(row.department_code ?? firstRelation(row.departments)?.code);
}

/** Return the display tier: leadership, managers, then all employees. */
export function getStaffTier(row: StaffOrderingRecord) {
  const role = roleCode(row);
  const title = jobTitleCode(row);

  if (TBT_ROLE_CODES.has(role) || TBT_TITLE_CODES.has(title)) return 1;
  if (DEPUTY_ROLE_CODES.has(role) || DEPUTY_TITLE_CODES.has(title)) return 2;
  if (
    role === "truong_phong" || title === "truong_phong" ||
    role.startsWith("phu_trach_phong_") || title.startsWith("phu_trach_phong_") ||
    role.startsWith("truong_phong_") || title.startsWith("truong_phong_")
  ) return 3;
  if (departmentCode(row) === "leadership") return 4;
  return 4;
}

function level(row: StaffOrderingRecord) {
  const value = row.role_level ?? firstRelation(row.roles)?.level;
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

function displayOrder(row: StaffOrderingRecord) {
  const value = row.job_title_display_order ?? firstRelation(row.job_titles)?.display_order;
  return typeof value === "number" && Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function listOrder(row: StaffOrderingRecord) {
  const value = row.list_order;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

const viCollator = new Intl.Collator("vi", { sensitivity: "base", numeric: false });

/**
 * Stable hierarchy sort.  It returns a new array and never mutates API state
 * held by callers.
 */
export function sortStaffRows<T extends StaffOrderingRecord>(rows: readonly T[]) {
  return [...rows].sort((a, b) => {
    const aListOrder = listOrder(a);
    const bListOrder = listOrder(b);
    const aPinned = aListOrder > 0;
    const bPinned = bListOrder > 0;

    // Pinned rows are always below every normal row. Their positive order is
    // the only primary ordering key, so role/title changes cannot move them.
    if (aPinned !== bPinned) return aPinned ? 1 : -1;
    if (aPinned && bPinned && aListOrder !== bListOrder) return aListOrder - bListOrder;

    const tierDifference = getStaffTier(a) - getStaffTier(b);
    if (tierDifference) return tierDifference;

    const levelDifference = level(b) - level(a);
    if (levelDifference) return levelDifference;

    const displayDifference = displayOrder(a) - displayOrder(b);
    if (displayDifference) return displayDifference;

    const nameDifference = viCollator.compare(a.full_name ?? "", b.full_name ?? "");
    if (nameDifference) return nameDifference;

    return code(a.id).localeCompare(code(b.id), "en");
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SORTS = new Set(["updated_at", "created_at", "record_code", "title", "status"]);
const PAGE_SIZES = new Set([20, 50, 100]);

const optional = (value) => value === null || value === undefined || value === "" ? undefined : value;
const validDate = (value) => {
  if (!value) return true;
  if (!DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const validUuid = (value) => !value || UUID.test(value);

export function parseRecordListParams(params) {
  const get = (key) => optional(params.get(key));
  const dates = ["createdFrom", "createdTo", "updatedFrom", "updatedTo"];
  const uuidKeys = ["recordTypeId", "categoryId", "departmentId", "ownerId", "createdBy"];
  if (dates.some((key) => !validDate(get(key))) || uuidKeys.some((key) => !validUuid(get(key)))) throw new Error("invalid_filter");
  const hasFiles = get("hasFiles");
  if (hasFiles !== undefined && !["0", "1", "true", "false"].includes(hasFiles)) throw new Error("invalid_filter");
  const sort = get("sort") ?? "updated_at";
  const sortDir = get("sortDir") ?? "desc";
  const visibility = get("visibility");
  if (visibility !== undefined && !["department", "public"].includes(visibility)) throw new Error("invalid_filter");
  if (!SORTS.has(sort) || !["asc", "desc"].includes(sortDir)) throw new Error("invalid_filter");
  const pageSize = Number(params.get("pageSize") ?? params.get("limit") ?? 20);
  const rawOffset = params.get("offset");
  const page = Number(params.get("page") ?? (rawOffset === null ? 1 : Math.floor(Number(rawOffset) / pageSize) + 1));
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || !PAGE_SIZES.has(pageSize)) throw new Error("invalid_filter");
  const offset = rawOffset === null ? (page - 1) * pageSize : Number(rawOffset);
  if (!Number.isInteger(offset) || offset < 0) throw new Error("invalid_filter");
  return { q: params.get("q") ?? "", status: get("status"), visibility, recordTypeId: get("recordTypeId"), categoryId: get("categoryId"), languageCode: get("languageCode"), createdFrom: get("createdFrom"), createdTo: get("createdTo"), updatedFrom: get("updatedFrom"), updatedTo: get("updatedTo"), departmentId: get("departmentId"), ownerId: get("ownerId"), createdBy: get("createdBy"), hasFiles: hasFiles === undefined ? undefined : ["1", "true"].includes(hasFiles), keyword: get("keyword"), sort, sortDir, limit: pageSize, offset, page, pageSize };
}

export function serializeRecordListState(state) {
  const params = new URLSearchParams();
  const keys = ["q", "categoryId", "recordTypeId", "languageCode", "status", "visibility", "createdFrom", "createdTo", "updatedFrom", "updatedTo", "departmentId", "ownerId", "createdBy", "keyword", "sort", "sortDir"];
  for (const key of keys) if (state[key]) params.set(key, String(state[key]));
  if (state.hasFiles !== undefined) params.set("hasFiles", state.hasFiles ? "1" : "0");
  if (state.page && state.page !== 1) params.set("page", String(state.page));
  if (state.pageSize && state.pageSize !== 20) params.set("pageSize", String(state.pageSize));
  return params;
}

export function parseRecordListState(params) {
  const parsed = parseRecordListParams(params);
  return { q: parsed.q, categoryId: parsed.categoryId ?? "", recordTypeId: parsed.recordTypeId ?? "", languageCode: parsed.languageCode ?? "", status: parsed.status ?? "", ...(parsed.visibility ? { visibility: parsed.visibility } : {}), page: parsed.page, pageSize: parsed.pageSize, sort: parsed.sort, sortDir: parsed.sortDir, createdFrom: parsed.createdFrom ?? "", createdTo: parsed.createdTo ?? "", updatedFrom: parsed.updatedFrom ?? "", updatedTo: parsed.updatedTo ?? "", departmentId: parsed.departmentId ?? "", ownerId: parsed.ownerId ?? "", createdBy: parsed.createdBy ?? "", hasFiles: parsed.hasFiles, keyword: parsed.keyword ?? "" };
}

export const recordListSorts = ["updated_at", "created_at", "record_code", "title", "status"];

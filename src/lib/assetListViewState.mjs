export const ASSET_LIST_VIEW_STORAGE_KEY = "thoidai.assets.listView.v1";

const QUICK_FILTERS = new Set(["all", "in_use", "unassigned", "lot", "needs_maintenance", "broken"]);

export function defaultAssetListViewState() {
  return { qName: "", qDepartment: "", qLocation: "", qCondition: "", qUsage: "", quickFilter: "all", qAssignee: "", windowScrollY: 0, tableScrollTop: 0, tableScrollLeft: 0 };
}

export function parseAssetListViewState(value) {
  const defaults = defaultAssetListViewState();
  if (typeof value !== "string") return defaults;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return defaults;
    const stringKeys = ["qName", "qDepartment", "qLocation", "qCondition", "qUsage", "qAssignee"];
    if (stringKeys.some((key) => parsed[key] !== undefined && typeof parsed[key] !== "string")) return defaults;
    if (parsed.quickFilter !== undefined && (typeof parsed.quickFilter !== "string" || !QUICK_FILTERS.has(parsed.quickFilter))) return defaults;
    const numberKeys = ["windowScrollY", "tableScrollTop", "tableScrollLeft"];
    if (numberKeys.some((key) => parsed[key] !== undefined && (!Number.isFinite(parsed[key]) || parsed[key] < 0))) return defaults;
    return { ...defaults, ...Object.fromEntries(stringKeys.map((key) => [key, parsed[key] ?? defaults[key]])), quickFilter: parsed.quickFilter ?? defaults.quickFilter, ...Object.fromEntries(numberKeys.map((key) => [key, parsed[key] ?? defaults[key]])) };
  } catch {
    return defaults;
  }
}

export function serializeAssetListViewState(state) {
  return JSON.stringify({ ...defaultAssetListViewState(), ...state });
}

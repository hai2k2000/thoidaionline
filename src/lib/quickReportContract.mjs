export const STANDARD_WORKFLOW = "STANDARD";
export const REPORT_ONLY_WORKFLOW = "REPORT_ONLY";

export const QUICK_REPORT_CATEGORIES = [
  "computer",
  "network",
  "printer_device",
  "facilities",
  "official_document",
  "administration",
  "other",
];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_FIELDS = new Set([
  "title", "category", "startDate", "completionDate", "status", "notes",
]);

const clean = (value, max) => {
  if (typeof value !== "string") return "";
  const normalized = value.normalize("NFC").trim();
  return [...normalized].length <= max ? normalized : "";
};

export function validateQuickReportDateRange(startDate, completionDate) {
  if (!DATE.test(startDate ?? "")) return "startDate";
  if (completionDate !== null && !DATE.test(completionDate ?? "")) return "completionDate";
  const parsedStart = new Date(`${startDate}T00:00:00Z`);
  if (parsedStart.toISOString().slice(0, 10) !== startDate) return "startDate";
  if (completionDate !== null && new Date(`${completionDate}T00:00:00Z`).toISOString().slice(0, 10) !== completionDate) return "completionDate";
  if (completionDate !== null && completionDate < startDate) return "completionDate";
  return null;
}

export function normalizeQuickReportRow(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("row");
  for (const key of Object.keys(value)) {
    if (!ALLOWED_FIELDS.has(key)) throw new Error(key);
  }
  const title = clean(value.title, 500);
  const category = QUICK_REPORT_CATEGORIES.find((item) => item === value.category);
  const startDate = typeof value.startDate === "string" && DATE.test(value.startDate) ? value.startDate : null;
  const completionDate = value.completionDate === "" || value.completionDate === null || value.completionDate === undefined
    ? null
    : typeof value.completionDate === "string" && DATE.test(value.completionDate) ? value.completionDate : "";
  const status = value.status === "in_progress" || value.status === "done" ? value.status : null;
  const notes = clean(value.notes ?? "", 10000);
  if (!title) throw new Error("title");
  if (!category) throw new Error("category");
  const dateError = validateQuickReportDateRange(startDate, completionDate);
  if (dateError) throw new Error(dateError);
  if (!status) throw new Error("status");
  if (status === "done" && completionDate === null) throw new Error("completionDate");
  return { title, category, startDate, completionDate, status, notes };
}

export function normalizeQuickReportBatch(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) throw new Error("batch size 1-50");
  return value.map((item, index) => {
    try { return normalizeQuickReportRow(item); }
    catch (error) { throw new Error(`row ${index + 1}: ${error instanceof Error ? error.message : "invalid"}`); }
  });
}

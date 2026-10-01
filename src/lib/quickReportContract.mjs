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

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_FIELDS = new Set([
  "title", "category", "workDate", "startedTime", "completedTime", "status", "notes",
]);

const clean = (value, max) => {
  if (typeof value !== "string") return "";
  const normalized = value.normalize("NFC").trim();
  return [...normalized].length <= max ? normalized : "";
};

export function validateQuickReportTimeRange(startedTime, completedTime) {
  if (!HH_MM.test(startedTime ?? "")) return "startedTime";
  if (completedTime !== null && !HH_MM.test(completedTime ?? "")) return "completedTime";
  if (completedTime !== null && completedTime < startedTime) return "completedTime";
  return null;
}

export function normalizeQuickReportRow(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("row");
  for (const key of Object.keys(value)) {
    if (!ALLOWED_FIELDS.has(key)) throw new Error(key);
  }
  const title = clean(value.title, 500);
  const category = QUICK_REPORT_CATEGORIES.find((item) => item === value.category);
  const workDate = typeof value.workDate === "string" && DATE.test(value.workDate) ? value.workDate : null;
  const parsedDate = workDate ? new Date(`${workDate}T00:00:00Z`) : null;
  const startedTime = typeof value.startedTime === "string" ? value.startedTime : "";
  const completedTime = value.completedTime === "" || value.completedTime === null || value.completedTime === undefined
    ? null
    : typeof value.completedTime === "string" ? value.completedTime : "";
  const status = value.status === "in_progress" || value.status === "done" ? value.status : null;
  const notes = clean(value.notes ?? "", 10000);
  if (!title) throw new Error("title");
  if (!category) throw new Error("category");
  if (!workDate || !parsedDate || parsedDate.toISOString().slice(0, 10) !== workDate) throw new Error("workDate");
  const timeError = validateQuickReportTimeRange(startedTime, completedTime);
  if (timeError) throw new Error(timeError);
  if (!status) throw new Error("status");
  if (status === "done" && completedTime === null) throw new Error("completedTime");
  return { title, category, workDate, startedTime, completedTime, status, notes };
}

export function normalizeQuickReportBatch(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) throw new Error("batch size 1-50");
  return value.map((item, index) => {
    try { return normalizeQuickReportRow(item); }
    catch (error) { throw new Error(`row ${index + 1}: ${error instanceof Error ? error.message : "invalid"}`); }
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = ["new", "in_progress", "blocked", "waiting", "pending_review", "rejected", "done", "cancelled"];
const PUBLICATION_STATUSES = ["not_published", "scheduled", "published", "withdrawn"];
const VERIFICATION_STATUSES = ["unverified", "verified", "rejected", "stale"];

export const REPORTING_DATE_BASIS = "created_at";
export const REPORTING_DEFAULT_LIMIT = 5000;
export const REPORTING_RECENT_LIMIT = 15;
export const REPORTING_ATTENTION_LIMIT = 20;

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? value : null;
}
function todayVietnam(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

function currentMonthStart(now = new Date()) {
  const today = todayVietnam(now);
  return `${today.slice(0, 8)}01`;
}

function uuidOrNull(value) {
  return typeof value === "string" && UUID.test(value) ? value : null;
}

function enumOrNull(values, value) {
  return typeof value === "string" && values.includes(value) ? value : null;
}

/** @param {URLSearchParams} params */
export function parseJournalismReportingSearchParams(params, now = new Date()) {
  const defaultFrom = currentMonthStart(now);
  const defaultTo = todayVietnam(now);
  const rawFrom = validDate(params.get("from"));
  const rawTo = validDate(params.get("to"));
  const fromDate = rawFrom && rawTo && rawFrom > rawTo ? rawTo : rawFrom ?? defaultFrom;
  const toDate = rawFrom && rawTo && rawFrom > rawTo ? rawFrom : rawTo ?? defaultTo;
  return {
    fromDate,
    toDate,
    departmentId: uuidOrNull(params.get("department")),
    assigneeId: uuidOrNull(params.get("assignee")),
    topicId: uuidOrNull(params.get("topic")),
    seriesId: uuidOrNull(params.get("series")),
    status: enumOrNull(STATUSES, params.get("status")),
    publicationStatus: enumOrNull(PUBLICATION_STATUSES, params.get("publicationStatus")),
    verificationStatus: enumOrNull(VERIFICATION_STATUSES, params.get("verificationStatus")),
  };
}

export function journalismReportingHref(query, patch = {}) {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.fromDate) params.set("from", next.fromDate);
  if (next.toDate) params.set("to", next.toDate);
  if (next.departmentId) params.set("department", next.departmentId);
  if (next.assigneeId) params.set("assignee", next.assigneeId);
  if (next.topicId) params.set("topic", next.topicId);
  if (next.seriesId) params.set("series", next.seriesId);
  if (next.status) params.set("status", next.status);
  if (next.publicationStatus) params.set("publicationStatus", next.publicationStatus);
  if (next.verificationStatus) params.set("verificationStatus", next.verificationStatus);
  const value = params.toString();
  return value ? `/journalism/reports?${value}` : "/journalism/reports";
}

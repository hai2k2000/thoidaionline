const TASK_SCOPES = ["all", "assigned", "personal", "watching", "cancelled"];
const TASK_TYPES = ["assigned", "personal"];
const TASK_STATUS_GROUPS = ["completed", "unfinished", "returned", "cancelled"];
const TASK_STATUSES = [
  "new", "in_progress", "blocked", "waiting", "pending_review",
  "done", "rejected", "cancelled",
];
const DEADLINE_STATES = ["on_time", "due_soon", "overdue", "no_deadline"];
const JOURNALISM_FILTERS = ["only", "exclude"];
const PUBLICATION_STATUSES = ["not_published", "scheduled", "published", "withdrawn"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function applyJournalismExcludeFilter(query) {
  return query.is("journalism", null);
}

const member = (values, value) => values.find((candidate) => candidate === value);

const validDate = (value) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? value
    : null;
};

/**
 * @param {URLSearchParams} params
 * @returns {import("./taskContracts").TaskListQuery}
 */
export function parseTaskListSearchParams(params) {
  const page = Number(params.get("page") ?? "1");
  const pageSize = Number(params.get("pageSize") ?? "25");
  const search = params.get("q")?.normalize("NFC").trim() ?? "";
  const departmentId = params.get("department");
  const journalismWorkKindId = params.get("workKind");
  const parsedJournalismWorkKindId = journalismWorkKindId && UUID.test(journalismWorkKindId)
    ? journalismWorkKindId
    : null;
  const parsedPublicationStatus = member(PUBLICATION_STATUSES, params.get("publicationStatus")) ?? null;
  const parsedPlannedPublicationFrom = validDate(params.get("plannedFrom"));
  const parsedPlannedPublicationTo = validDate(params.get("plannedTo"));
  const requestedJournalism = member(JOURNALISM_FILTERS, params.get("journalism")) ?? null;
  const category = params.get("category") === "duty" ? "duty" : null;
  const isNormalOnly = requestedJournalism === "exclude";
  return {
    search: search && [...search].length <= 200 ? search : null,
    scope: member(TASK_SCOPES, params.get("scope")) ?? "all",
    taskType: member(TASK_TYPES, params.get("type")) ?? null,
    ...(category ? { category } : {}),
    status: member(TASK_STATUSES, params.get("status")) ?? null,
    statusGroup: member(TASK_STATUS_GROUPS, params.get("state"))
      ?? (params.get("status") === "active" ? "unfinished" : null),
    fromDate: validDate(params.get("from")),
    toDate: validDate(params.get("to")),
    deadlineState: member(DEADLINE_STATES, params.get("deadline")) ?? null,
    departmentId: departmentId && UUID.test(departmentId) ? departmentId : null,
    journalism: requestedJournalism
      ?? (parsedJournalismWorkKindId || parsedPublicationStatus || parsedPlannedPublicationFrom || parsedPlannedPublicationTo ? "only" : null),
    journalismWorkKindId: isNormalOnly ? null : parsedJournalismWorkKindId,
    publicationStatus: isNormalOnly ? null : parsedPublicationStatus,
    plannedPublicationFrom: isNormalOnly ? null : parsedPlannedPublicationFrom,
    plannedPublicationTo: isNormalOnly ? null : parsedPlannedPublicationTo,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: Number.isInteger(pageSize) && pageSize > 0 && pageSize <= 100
      ? pageSize
      : 25,
  };
}

/**
 * @param {import("./taskContracts").TaskListQuery} query
 * @param {Partial<import("./taskContracts").TaskListQuery>} patch
 */
export function taskListHref(query, patch) {
  const next = { ...query, ...patch };
  const journalismSubfilter = Boolean(
    next.journalismWorkKindId
    || next.publicationStatus
    || next.plannedPublicationFrom
    || next.plannedPublicationTo,
  );
  if (Object.hasOwn(patch, "journalism") && patch.journalism !== "only") {
    next.journalismWorkKindId = null;
    next.publicationStatus = null;
    next.plannedPublicationFrom = null;
    next.plannedPublicationTo = null;
  } else if (!next.journalism && journalismSubfilter) {
    next.journalism = "only";
  }
  const params = new URLSearchParams();
  if (next.search) params.set("q", next.search);
  if (next.scope !== "all") params.set("scope", next.scope);
  if (next.taskType) params.set("type", next.taskType);
  if (next.category) params.set("category", next.category);
  if (next.status) params.set("status", next.status);
  if (next.fromDate) params.set("from", next.fromDate);
  if (next.statusGroup) params.set("state", next.statusGroup);
  if (next.toDate) params.set("to", next.toDate);
  if (next.deadlineState) params.set("deadline", next.deadlineState);
  if (next.departmentId) params.set("department", next.departmentId);
  if (next.journalism) params.set("journalism", next.journalism);
  if (next.journalismWorkKindId) params.set("workKind", next.journalismWorkKindId);
  if (next.publicationStatus) params.set("publicationStatus", next.publicationStatus);
  if (next.plannedPublicationFrom) params.set("plannedFrom", next.plannedPublicationFrom);
  if (next.plannedPublicationTo) params.set("plannedTo", next.plannedPublicationTo);
  if (next.page > 1) params.set("page", String(next.page));
  if (next.pageSize !== 25) params.set("pageSize", String(next.pageSize));
  const value = params.toString();
  return value ? `/tasks?${value}` : "/tasks";
}

/** @param {import("./taskContracts").TaskListQuery} query */
export function countTaskListFilters(query) {
  return [
    query.search,
    query.taskType,
    query.category,
    query.status,
    query.statusGroup,
    query.deadlineState,
    query.fromDate,
    query.toDate,
    query.departmentId,
    query.journalism,
    query.journalismWorkKindId,
    query.publicationStatus,
    query.plannedPublicationFrom,
    query.plannedPublicationTo,
  ].filter(Boolean).length;
}

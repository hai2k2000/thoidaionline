const TASK_SCOPES = ["all", "assigned", "personal", "watching"];
const TASK_TYPES = ["assigned", "personal"];
const TASK_STATUSES = [
  "new", "in_progress", "blocked", "waiting", "pending_review",
  "done", "rejected", "cancelled",
];
const DEADLINE_STATES = ["on_time", "due_soon", "overdue", "no_deadline"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  return {
    search: search && [...search].length <= 200 ? search : null,
    scope: member(TASK_SCOPES, params.get("scope")) ?? "all",
    taskType: member(TASK_TYPES, params.get("type")) ?? null,
    status: member(TASK_STATUSES, params.get("status")) ?? null,
    fromDate: validDate(params.get("from")),
    toDate: validDate(params.get("to")),
    deadlineState: member(DEADLINE_STATES, params.get("deadline")) ?? null,
    departmentId: departmentId && UUID.test(departmentId) ? departmentId : null,
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
  const params = new URLSearchParams();
  if (next.search) params.set("q", next.search);
  if (next.scope !== "all") params.set("scope", next.scope);
  if (next.taskType) params.set("type", next.taskType);
  if (next.status) params.set("status", next.status);
  if (next.fromDate) params.set("from", next.fromDate);
  if (next.toDate) params.set("to", next.toDate);
  if (next.deadlineState) params.set("deadline", next.deadlineState);
  if (next.departmentId) params.set("department", next.departmentId);
  if (next.page > 1) params.set("page", String(next.page));
  if (next.pageSize !== 25) params.set("pageSize", String(next.pageSize));
  const value = params.toString();
  return value ? `/tasks?${value}` : "/tasks";
}
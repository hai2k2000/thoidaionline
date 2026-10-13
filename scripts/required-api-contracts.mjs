import { canUseJournalism } from "../src/lib/journalismScope.mjs";

export const REQUIRED_API_CONTRACTS = [
  { name: "tasks-normal", path: "/api/tasks?journalism=exclude", shape: ["tasks"] },
  { name: "tasks-journalism", path: "/api/tasks?journalism=only&page=1&pageSize=10", shape: ["tasks"], authorization: "journalism" },
  { name: "tasks-assignment-approval", path: "/api/tasks?approvalQueue=assignment", shape: ["tasks"] },
  { name: "tasks-completion-approval", path: "/api/tasks?approvalQueue=completion", shape: ["tasks"] },
  { name: "personal-schedule", path: "/api/work-schedule/personal", shape: ["rows"] },
  { name: "work-schedule", path: "/api/work-schedule", shape: ["rows"] },
  { name: "event-assignment", path: "/api/work-schedule/events?from=2026-01-01&to=2026-12-31", shape: ["rows"] },
  { name: "journalism-calendar", path: "/api/journalism/calendar", shape: ["calendar"], authorization: "journalism" },
  { name: "journalism-topics", path: "/api/journalism/topics", shape: ["topics"], authorization: "journalism" },
  { name: "journalism-series", path: "/api/journalism/series", shape: ["series"], authorization: "journalism" },
  { name: "attendance", path: "/api/attendance", buildPath: buildAttendancePath, shape: ["rows", "monthlyRows"] },
  { name: "notifications", path: "/api/notifications", shape: ["items", "unreadCount"] },
  { name: "session", path: "/api/auth/session", shape: ["user"] },
];

export function canUseJournalismForSmoke(user) {
  return canUseJournalism({
    roleCode: user?.role_code,
    departmentCode: user?.department_code,
    rbacPermissions: user?.rbacPermissions,
  });
}

export function buildAttendancePath(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now).reduce((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return `/api/attendance?date=${date}&period=day&scope=personal`;
}

export function resolveContractPath(contract, now = new Date()) {
  return contract.buildPath ? contract.buildPath(now) : contract.path;
}

export function validateContractResponse(contract, response, body, context = {}) {
  const expectedStatus = contract.authorization === "journalism"
    ? context.sessionUser
      ? canUseJournalismForSmoke(context.sessionUser) ? 200 : 403
      : null
    : 200;
  if (expectedStatus === null) return { ok: false, reason: `${contract.name}: authorization context unavailable` };
  if (!response || response.status !== expectedStatus) return { ok: false, reason: `${contract.name}: expected ${expectedStatus}, got ${response?.status ?? "no response"}` };
  if (expectedStatus === 403) return { ok: true, reason: `${contract.name}: expected 403 for unauthorized journalism access` };
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, reason: `${contract.name}: response must be a JSON object` };
  if (contract.name === "session") {
    const user = body.user;
    if (!user || typeof user !== "object" || Array.isArray(user)) return { ok: false, reason: `${contract.name}: user must be an object` };
    if (typeof user.role_code !== "string" || !(user.department_code === null || typeof user.department_code === "string") || !Array.isArray(user.rbacPermissions)) {
      return { ok: false, reason: `${contract.name}: user authorization context is incomplete` };
    }
  }
  const missing = contract.shape.filter((key) => !Object.hasOwn(body, key));
  return missing.length ? { ok: false, reason: `${contract.name}: missing ${missing.join(", ")}` } : { ok: true };
}

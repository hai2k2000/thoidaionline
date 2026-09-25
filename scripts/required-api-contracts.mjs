export const REQUIRED_API_CONTRACTS = [
  { name: "tasks-normal", path: "/api/tasks?journalism=false", shape: ["tasks"] },
  { name: "tasks-journalism", path: "/api/tasks?journalism=true", shape: ["tasks"] },
  { name: "tasks-assignment-approval", path: "/api/tasks?approvalQueue=assignment", shape: ["tasks"] },
  { name: "tasks-completion-approval", path: "/api/tasks?approvalQueue=completion", shape: ["tasks"] },
  { name: "personal-schedule", path: "/api/work-schedule/personal", shape: ["rows"] },
  { name: "work-schedule", path: "/api/work-schedule", shape: ["rows"] },
  { name: "event-assignment", path: "/api/work-schedule/events", shape: ["events"] },
  { name: "journalism-calendar", path: "/api/journalism/calendar", shape: ["calendar"] },
  { name: "journalism-topics", path: "/api/journalism/topics", shape: ["topics"] },
  { name: "journalism-series", path: "/api/journalism/series", shape: ["series"] },
  { name: "attendance", path: "/api/attendance", shape: ["rows"] },
  { name: "notifications", path: "/api/notifications", shape: ["items", "unreadCount"] },
  { name: "session", path: "/api/auth/session", shape: ["user"] },
];

export function validateContractResponse(contract, response, body) {
  if (!response || response.status !== 200) return { ok: false, reason: `${contract.name}: expected 200, got ${response?.status ?? "no response"}` };
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, reason: `${contract.name}: response must be a JSON object` };
  const missing = contract.shape.filter((key) => !Object.hasOwn(body, key));
  return missing.length ? { ok: false, reason: `${contract.name}: missing ${missing.join(", ")}` } : { ok: true };
}

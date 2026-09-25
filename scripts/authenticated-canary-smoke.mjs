import { readFileSync } from "node:fs";

const baseUrl = process.env.SMOKE_BASE_URL.replace(/\/$/, "");
const credentials = JSON.parse(readFileSync(process.env.SMOKE_CREDENTIAL_FILE, "utf8"));
const roles = [
  ["employee/reporter", credentials.employee_reporter, true, false],
  ["truong_phong", credentials.truong_phong, true, true],
  ["global_editorial", credentials.global_editorial, true, true],
  ["non_editorial", credentials.non_editorial, false, false],
];

function cookieFrom(response) {
  const values = response.headers.getSetCookie?.() ?? [];
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}
async function request(path, cookie, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { accept: "application/json", ...(options.method ? { origin: baseUrl } : {}), cookie, ...(options.headers ?? {}) } });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch {}
  return { response, body };
}
function requireShape(label, result, keys, expectedStatus = 200) {
  if (result.response.status !== expectedStatus) throw new Error(`${label}: expected ${expectedStatus}, got ${result.response.status}`);
  if (expectedStatus !== 200) return;
  if (!result.body || typeof result.body !== "object" || Array.isArray(result.body) || keys.some((key) => !Object.hasOwn(result.body, key))) throw new Error(`${label}: invalid response shape`);
}
for (const [label, credential, canJournalism, canApprove] of roles) {
  if (!credential?.username || !credential?.password) throw new Error(`${label}: credential entry missing`);
  const login = await request("/api/auth/login", "", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: credential.username, password: credential.password }) });
  if (login.response.status !== 200) throw new Error(`${label}: login ${login.response.status}`);
  const cookie = cookieFrom(login.response);
  const session = await request("/api/auth/session", cookie);
  requireShape(`${label} session`, session, ["user"]);
  const checks = [
    ["normal tasks", "/api/tasks?journalism=exclude&page=1&pageSize=10", ["tasks"], 200],
    ["personal", "/api/work-schedule/personal?from=2026-01-01&to=2026-12-31", ["rows"], 200],
    ["event assignment", "/api/work-schedule/events?from=2026-01-01&to=2026-12-31", ["rows"], 200],
    ["attendance", "/api/attendance?date=2026-09-25&period=day&scope=personal", ["rows", "monthlyRows"], 200],
    ["notifications", "/api/notifications", ["items", "unreadCount"], 200],
  ];
  if (canApprove) checks.push(["assignment queue", "/api/tasks?approvalQueue=assignment&page=1&pageSize=10", ["tasks"], 200], ["completion queue", "/api/tasks?approvalQueue=completion&page=1&pageSize=10", ["tasks"], 200], ["personal approval", "/api/work-schedule/personal?scope=approval&from=2026-01-01&to=2026-12-31", ["rows"], 200]);
  else checks.push(["personal approval denied", "/api/work-schedule/personal?scope=approval&from=2026-01-01&to=2026-12-31", [], 403]);
  if (canJournalism) {
    checks.push(["journalism tasks", "/api/tasks?journalism=only&page=1&pageSize=10", ["tasks"], 200], ["topics", "/api/journalism/topics", ["topics"], 200], ["series", "/api/journalism/series", ["series"], 200], ["calendar", "/api/journalism/calendar", ["calendar"], 200]);
  } else {
    checks.push(["journalism tasks denied", "/api/tasks?journalism=only", [], 403], ["topics denied", "/api/journalism/topics", [], 403], ["series denied", "/api/journalism/series", [], 403], ["calendar denied", "/api/journalism/calendar", [], 403]);
  }
  for (const [name, path, shape, status] of checks) {
    const result = await request(path, cookie);
    requireShape(`${label} ${name}`, result, shape, status);
  }
  for (const path of ["/api/tasks?journalism=exclude&page=1&pageSize=10", "/api/tasks?journalism=exclude&page=2&pageSize=10", "/api/work-schedule/personal?from=2026-01-01&to=2026-12-31"]) {
    const result = await request(path, cookie);
    if (result.response.status !== 200) throw new Error(`${label} repeat ${path}: ${result.response.status}`);
  }
  console.log(`PASS ${label}`);
}
console.log("authenticated-canary: PASS");

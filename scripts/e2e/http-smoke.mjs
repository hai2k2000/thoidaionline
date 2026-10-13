import { randomUUID } from "node:crypto";

const baseUrl = process.env.E2E_BASE_URL;
const mode = process.env.E2E_MODE ?? "new";
const adminUsername = process.env.E2E_ADMIN_USERNAME;
const employeeUsername = process.env.E2E_EMPLOYEE_USERNAME;
const password = process.env.E2E_PASSWORD;
const postgrestUrl = process.env.E2E_POSTGREST_URL;
const serviceRoleKey = process.env.E2E_SERVICE_ROLE_KEY;
if (!baseUrl || !/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl)) throw new Error("E2E_BASE_URL must be localhost-only");
if (!adminUsername || !employeeUsername || !password) throw new Error("E2E credentials are required");

const cookieFrom = (response) => response.headers.getSetCookie?.().map((value) => value.split(";", 1)[0]).join("; ") ?? response.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
const request = async (path, options = {}, cookie = "") => {
  const headers = new Headers(options.headers);
  headers.set("accept", "application/json");
  if (cookie) headers.set("cookie", cookie);
  if (options.body) headers.set("content-type", "application/json");
  return fetch(`${baseUrl}${path}`, { ...options, headers, redirect: "manual" });
};
const json = async (response) => response.json().catch(() => ({}));
const expectStatus = (response, expected, label) => {
  if (response.status !== expected) {
    response.clone().json().then((body) => console.error(`::error title=HTTP E2E response::${label}: ${JSON.stringify(body)}`)).catch(() => {});
    console.error(`::error title=HTTP E2E status::${label}: expected ${expected}, got ${response.status}`);
    throw new Error(`${label}: expected ${expected}, got ${response.status}`);
  }
};
const expectQuickReportStatus = async (response, expected, label) => {
  if (response.status === expected) return response;
  const body = await json(response);
  console.error(`::error title=Quick Report E2E status::${label}: expected ${expected}, got ${response.status} (${JSON.stringify(body?.error ?? body)})`);
  throw new Error(`${label}: expected ${expected}, got ${response.status} (${JSON.stringify(body?.error ?? body)})`);
};

async function login(username) {
  const response = await request("/api/auth/login", { method: "POST", headers: { origin: baseUrl, host: new URL(baseUrl).host }, body: JSON.stringify({ identifier: username, password }) });
  expectStatus(response, 200, `login ${username}`);
  const cookie = cookieFrom(response);
  if (!cookie) throw new Error(`login ${username}: missing session cookie`);
  const session = await request("/api/auth/session", {}, cookie);
  expectStatus(session, 200, `session ${username}`);
  return cookie;
}

const admin = await login(adminUsername);
const employee = await login(employeeUsername);
const adminAssets = await request("/api/assets?options=1", {}, admin);
expectStatus(adminAssets, 200, "admin asset options");
const adminAssetBody = await json(adminAssets);
if (!Array.isArray(adminAssetBody.assets) || !Array.isArray(adminAssetBody.users)) throw new Error("admin asset payload incomplete");

const employeeAssets = await request("/api/assets", {}, employee);
expectStatus(employeeAssets, 200, "employee asset list");
const employeeAssetBody = await json(employeeAssets);
if (!employeeAssetBody.assets?.some((asset) => asset.asset_code === "E2E-001")) throw new Error("employee cannot see assigned asset");
const forbiddenOptions = await request("/api/assets?options=1", {}, employee);
expectStatus(forbiddenOptions, 403, "employee asset options authorization");

const adminPermissions = await request("/api/permissions", {}, admin);
if (adminPermissions.status !== 200) {
  console.error(`::error title=Permission catalog response::${JSON.stringify(await json(adminPermissions))}`);
}
expectStatus(adminPermissions, 200, "admin permission catalog");
const permissionBody = await json(adminPermissions);
if (mode === "new" && !permissionBody.effectiveCatalog?.some((row) => row.permission_code === "permission.manage" && row.effective_scopes?.length)) throw new Error("admin permission.manage missing");
expectStatus(await request("/api/permissions", {}, employee), 403, "employee permission UI authorization");

const quickReportPage = await request("/tasks/quick-report", {}, admin);
expectStatus(quickReportPage, 200, "admin quick report page");
const report = (cookie, id) => request("/api/tasks/quick-report", { method: "POST", headers: { origin: baseUrl, host: new URL(baseUrl).host }, body: JSON.stringify({ requestId: id, rows: [{ title: "E2E quick report", category: "other", startDate: "2026-10-13", completionDate: null, status: "in_progress", notes: "isolated" }] }) }, cookie);
await expectQuickReportStatus(await report(admin, randomUUID()), 201, "admin quick report mutation");
expectStatus(await report(employee, randomUUID()), 403, "employee quick report denied before override");

if (mode === "old") {
  console.log("isolated HTTP E2E: PASS (old app login/session, assets, quick report, legacy permission denial)");
  process.exit(0);
}

const employeeId = "30000000-0000-0000-0000-000000000002";
const adminRole = permissionBody.roles?.find((role) => role.code === "admin");
if (!adminRole) throw new Error("admin role matrix missing");
const withoutManager = adminRole.modules.flatMap((module) => module.permissions)
  .filter((permission) => permission.code !== "permission.manage" && permission.scopes.length)
  .map((permission) => ({ permissionCode: permission.code, scopes: permission.scopes }));
console.error(`::warning title=Last manager payload::${JSON.stringify({ grantCount: withoutManager.length, grants: withoutManager })}`);
const lastManager = await request("/api/permissions", { method: "POST", headers: { origin: baseUrl, host: new URL(baseUrl).host }, body: JSON.stringify({ action: "replace_role_permissions", roleId: adminRole.id, grants: withoutManager }) }, admin);
if (lastManager.status !== 403) console.error(`::error title=Last manager response::${JSON.stringify(await lastManager.clone().json().catch(() => ({})))}`);
expectStatus(lastManager, 403, "last permission manager protection");

const override = async (effect) => {
  const response = await request("/api/permissions", { method: "POST", headers: { origin: baseUrl, host: new URL(baseUrl).host }, body: JSON.stringify({ action: "set_user_override", userId: employeeId, permissionCode: "task.quick_report.create", effect, scope: "all" }) }, admin);
  expectStatus(response, 200, `employee ${effect} override`);
};
await override("allow");
await expectQuickReportStatus(await report(employee, randomUUID()), 201, "employee quick report allowed override");
await override("deny");
expectStatus(await report(employee, randomUUID()), 403, "employee quick report denied override");
if (!postgrestUrl || !serviceRoleKey) throw new Error("rollback compatibility probe configuration missing");
const rollbackGate = async () => fetch(`${postgrestUrl}/rpc/rbac_v2_assert_legacy_rollback_compatible`, { method: "POST", headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, "content-type": "application/json" }, body: "{}" });
if ((await rollbackGate()).ok) throw new Error("rollback compatibility gate accepted an explicit deny");
const selfOverride = await request("/api/permissions", { method: "POST", headers: { origin: baseUrl, host: new URL(baseUrl).host }, body: JSON.stringify({ action: "set_user_override", userId: "30000000-0000-0000-0000-000000000001", permissionCode: "asset.manage", effect: "allow", scope: "all" }) }, admin);
expectStatus(selfOverride, 403, "self override protection");
const restore = await request("/api/permissions", { method: "POST", headers: { origin: baseUrl, host: new URL(baseUrl).host }, body: JSON.stringify({ action: "restore_user_inheritance", userId: employeeId }) }, admin);
expectStatus(restore, 200, "restore user inheritance");
if (!(await rollbackGate()).ok) throw new Error("rollback compatibility gate did not recover after restoring inheritance");

console.log("isolated HTTP E2E: PASS (login/session, permission matrix, assets, quick report, allow/deny, self/last-manager protection, rollback gate)");

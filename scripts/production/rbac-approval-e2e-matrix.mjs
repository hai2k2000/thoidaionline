import assert from "node:assert/strict";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const password = process.env.RBAC_E2E_PASSWORD;
if (!password) throw new Error("RBAC_E2E_PASSWORD is required");
const REQUEST_TIMEOUT_MS = 20_000;
const users = new Map();
const result = { passed: 0, failed: 0 };

function cookieOf(response) {
  return response.headers.getSetCookie?.().map((value) => value.split(";", 1)[0]).join("; ")
    ?? response.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
}
async function request(path, options = {}, cookie = "") {
  const headers = new Headers(options.headers);
  headers.set("accept", "application/json");
  headers.set("origin", baseUrl);
  if (cookie) headers.set("cookie", cookie);
  if (options.body) headers.set("content-type", "application/json");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${baseUrl}${path}`, { ...options, headers, redirect: "manual", signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("timeout");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
async function body(response) { return response.json().catch(() => ({})); }
async function login(name) {
  const response = await request("/api/auth/login", { method: "POST", body: JSON.stringify({ identifier: `zz_e2e_${name}`, password }) });
  if (response.status !== 200) throw new Error(`login ${name}: ${response.status}`);
  const cookie = cookieOf(response); if (!cookie) throw new Error(`login ${name}: missing cookie`);
  users.set(name, cookie); return cookie;
}
async function expectCase(id, fn) {
  try { await fn(); result.passed++; console.log(`E2E_PASS ${id}`); }
  catch (error) { result.failed++; console.log(`E2E_FAIL ${id} ${String(error?.message ?? error).replace(/[\r\n]+/g, " ").slice(0, 240)}`); }
}
async function expectStatus(response, status, label) {
  assert.equal(response.status, status, `${label}: expected ${status}, got ${response.status}`);
  return body(response);
}
async function adminPost(payload) { const response = await request("/api/permissions", { method: "POST", body: JSON.stringify(payload) }, users.get("admin")); return response; }
async function seedIds() {
  const response = await request("/api/permissions", {}, users.get("admin"));
  const payload = await expectStatus(response, 200, "permission catalog");
  return Object.fromEntries((payload.users ?? []).filter((u) => u.username?.startsWith("zz_e2e_")).map((u) => [u.username.slice(7), u.id]));
}
function find(rows, needle) { return rows.find((row) => String(row.reason ?? row.title).includes(needle)); }
async function leaveQueue(name) { return body(await request("/api/leave-requests?from=2000-01-01&to=2100-12-31", {}, users.get(name))); }
async function planQueue(name) { return body(await request("/api/work-schedule/personal?scope=approval&from=2000-01-01&to=2100-12-31", {}, users.get(name))); }

for (const name of ["admin", "tbt", "ptbt", "manager_a", "deputy_a", "rep_a1", "rep_a2", "rep_b1", "staff_a"]) await login(name);
const inactive = await request("/api/auth/login", { method: "POST", body: JSON.stringify({ identifier: "zz_e2e_inactive_a", password }) });
const ids = await seedIds();
for (const payload of [
  { action: "set_user_override", userId: ids.rep_a1, permissionCode: "schedule.business.approve", effect: "allow", scope: "department" },
  { action: "set_user_override", userId: ids.rep_a2, permissionCode: "leave.approve", effect: "allow", scope: "all" },
  { action: "set_user_override", userId: ids.manager_a, permissionCode: "leave.approve", effect: "deny", scope: "all" },
  { action: "set_user_override", userId: ids.deputy_a, permissionCode: "leave.approve", effect: "allow", scope: "department" },
]) await expectStatus(await adminPost(payload), 200, "admin setup override");

await expectCase("1", async () => assert.equal((await leaveQueue("staff_a")).approvals.length, 0));
await expectCase("2", async () => { const rows = (await planQueue("rep_a1")).rows; assert.ok(rows.length > 0); assert.ok(rows.every((r) => r.plan_type === "business" && r.created_by !== ids.rep_a1)); });
await expectCase("3", async () => { const rows = (await leaveQueue("rep_a2")).approvals; assert.ok(rows.some((r) => r.reason.endsWith("one"))); assert.ok(rows.some((r) => r.reason.endsWith("leave_b"))); assert.ok(!rows.some((r) => r.reason.endsWith("four"))); });
await expectCase("4", async () => assert.ok((await leaveQueue("tbt")).approvals.some((r) => r.reason.endsWith("four"))));
await expectCase("5", async () => { const q = await leaveQueue("manager_a"); assert.equal(q.approvals.length, 0); assert.ok((await planQueue("manager_a")).rows.some((r) => r.title.includes("rep_a1_business"))); });
await expectCase("6", async () => assert.ok((await leaveQueue("ptbt")).approvals.every((r) => (new Date(r.end_date) - new Date(r.start_date)) / 86400000 + 1 < 4)));

async function businessPlan() { return find((await planQueue("rep_a1")).rows, "rep_a2_business"); }
async function leaveRequest() { return find((await leaveQueue("rep_a2")).approvals, "zz_e2e_leave_one"); }
await expectCase("7", async () => { const business = await businessPlan(); assert.ok(business); return expectStatus(await request("/api/work-schedule/personal", { method: "PATCH", body: JSON.stringify({ id: business.id, action: "approve", workflowRevision: business.workflow_revision }) }, users.get("rep_a1")), 200, "business approval"); });
await expectCase("8", async () => { const leaveA = await leaveRequest(); assert.ok(leaveA); return expectStatus(await request("/api/leave-requests", { method: "PATCH", body: JSON.stringify({ id: leaveA.id, action: "approve", actorId: ids.tbt, departmentId: "00000000-0000-4000-8000-000000000000", scope: "all", role: "admin" }) }, users.get("rep_a2")), 200, "leave approval"); });
await expectCase("9", async () => { const business = await businessPlan(); assert.ok(business); return expectStatus(await request("/api/work-schedule/personal", { method: "PATCH", body: JSON.stringify({ id: business.id, action: "approve", workflowRevision: business.workflow_revision }) }, users.get("rep_a1")), 409, "second approval"); });
await expectCase("10", async () => { const row = find((await planQueue("ptbt")).rows, "rep_a1_work"); assert.ok(row); await expectStatus(await request("/api/work-schedule/personal", { method: "PATCH", body: JSON.stringify({ id: row.id, action: "approve", workflowRevision: 0 }) }, users.get("ptbt")), 409, "stale revision"); });
await expectCase("11", async () => { const leaveSelf = find((await leaveQueue("rep_a1")).mine, "zz_e2e_leave_half"); const leaveA = await leaveRequest(); assert.ok(leaveSelf ?? leaveA); return expectStatus(await request("/api/leave-requests", { method: "PATCH", body: JSON.stringify({ id: leaveSelf?.id ?? leaveA.id, action: "approve" }) }, users.get("rep_a1")), 403, "self approval"); });
await expectCase("12", async () => { const leaveA = await leaveRequest(); assert.ok(leaveA); return expectStatus(await request("/api/leave-requests", { method: "PATCH", body: JSON.stringify({ id: leaveA.id, action: "approve", actorId: ids.tbt, departmentId: "00000000-0000-4000-8000-000000000000", scope: "all", role: "admin" }) }, users.get("staff_a")), 403, "spoof actor"); });
await expectCase("13", async () => { const business = await businessPlan(); assert.ok(business); return expectStatus(await request("/api/work-schedule/personal", { method: "PATCH", body: JSON.stringify({ id: business.id, action: "approve", workflowRevision: business.workflow_revision, actorId: ids.admin, departmentId: "00000000-0000-4000-8000-000000000000", scope: "all", role: "admin" }) }, users.get("staff_a")), 403, "spoof personal actor"); });
await expectCase("14", async () => expectStatus(await request(`/api/permissions/users/${ids.rep_a1}`, {}, users.get("staff_a")), 403, "non-admin detail"));
await expectCase("15", async () => expectStatus(await adminPost({ action: "set_user_override", userId: ids.admin, permissionCode: "leave.approve", effect: "allow", scope: "all" }), 403, "admin self override"));
await expectCase("16", async () => { const p = await expectStatus(await request(`/api/permissions/users/${ids.rep_a1}`, {}, users.get("admin")), 200, "detail"); const b = p.items.find((x) => x.permissionCode === "schedule.business.approve"); assert.deepEqual(b.effectiveScopes, ["department"]); assert.equal(b.source, "user_allow"); assert.equal(p.items.find((x) => x.permissionCode === "leave.approve").source, "none"); assert.equal(p.items.find((x) => x.permissionCode === "schedule.event.approve").source, "none"); });
await expectCase("17", async () => { const p = await expectStatus(await request(`/api/permissions/users/${ids.rep_a1}/history`, {}, users.get("admin")), 200, "history"); assert.ok(p.items.some((x) => x.actor?.name?.includes("zz_e2e_admin"))); });
await expectCase("18", async () => { await expectStatus(await adminPost({ action: "clear_user_override", userId: ids.rep_a1, permissionCode: "schedule.business.approve" }), 200, "clear override"); const row = find((await planQueue("rep_a1")).rows, "rep_a1_work"); await expectStatus(await request("/api/work-schedule/personal", { method: "PATCH", body: JSON.stringify({ id: row.id, action: "approve", workflowRevision: row.workflow_revision }) }, users.get("rep_a1")), 403, "revoked permission"); });
await expectCase("19", async () => expectStatus(await request("/api/permissions", {}, users.get("staff_a")), 403, "non-admin catalog"));
await expectCase("20", async () => assert.ok([401, 403].includes(inactive.status), `inactive login status ${inactive.status}`));

console.log(`E2E_RESULT=${result.failed ? "FAIL" : "PASS"} passed=${result.passed} failed=${result.failed}`);
if (result.failed) process.exitCode = 1;

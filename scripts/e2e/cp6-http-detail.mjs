import { appendFileSync, writeFileSync } from "node:fs";

const baseUrl = process.env.E2E_BASE_URL;
const gatewayUrl = process.env.E2E_GATEWAY_URL;
const username = process.env.E2E_ADMIN_USERNAME;
const password = process.env.E2E_PASSWORD;
const output = process.env.CP6_HTTP_EVIDENCE_LOG;
const recordId = "71000000-0000-4000-8000-000000000001";
const controlRecordId = "71000000-0000-4000-8000-000000000002";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl ?? "")) throw new Error("E2E_BASE_URL must be localhost-only");
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(gatewayUrl ?? "")) throw new Error("E2E_GATEWAY_URL must be localhost-only");
if (!username || !password || !output) throw new Error("synthetic HTTP benchmark configuration is required");

const cookieFrom = (response) => response.headers.getSetCookie?.().map((value) => value.split(";", 1)[0]).join("; ") ?? response.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
const request = (path, options = {}, cookie = "") => {
  const headers = new Headers(options.headers);
  headers.set("accept", "application/json");
  headers.set("origin", baseUrl);
  headers.set("host", new URL(baseUrl).host);
  if (cookie) headers.set("cookie", cookie);
  return fetch(`${baseUrl}${path}`, { ...options, headers, redirect: "manual" });
};
const login = await request("/api/auth/login", { method: "POST", body: JSON.stringify({ identifier: username, password }), headers: { "content-type": "application/json" } });
if (login.status !== 200) throw new Error(`HTTP detail login failed: ${login.status}`);
const cookie = cookieFrom(login);
if (!cookie) throw new Error("HTTP detail login did not return a session cookie");

const metric = async () => {
  const response = await fetch(`${gatewayUrl}/metrics`);
  if (!response.ok) throw new Error(`gateway metrics failed: ${response.status}`);
  return Number((await response.json()).forwardedRequestCount);
};
const reset = async () => {
  const response = await fetch(`${gatewayUrl}/metrics/reset`, { method: "POST" });
  if (!response.ok) throw new Error(`gateway metrics reset failed: ${response.status}`);
};
const measure = async (id, expectedAcl, expectedFiles) => {
  await reset();
  const started = performance.now();
  const response = await request(`/api/database/records/${id}`, {}, cookie);
  const body = await response.json().catch(() => ({}));
  const elapsed = performance.now() - started;
  if (response.status !== 200 || body.record?.record?.id !== id) throw new Error(`HTTP detail assertion failed: ${response.status}`);
  if (body.record.acl?.length !== expectedAcl || body.record.files?.length !== expectedFiles) {
    throw new Error(`HTTP detail fixture mismatch for ${id}: ACL ${body.record.acl?.length}, files ${body.record.files?.length}`);
  }
  return { elapsed, queryCount: await metric() };
};
const samples = [];
const targetQueryCounts = [];
const controlQueryCounts = [];
for (let i = 0; i < 35; i += 1) {
  const target = await measure(recordId, 20, 10);
  const control = await measure(controlRecordId, 0, 0);
  samples.push(target.elapsed);
  targetQueryCounts.push(target.queryCount);
  controlQueryCounts.push(control.queryCount);
}
if (targetQueryCounts.some((value) => !Number.isInteger(value) || value <= 0)) throw new Error("HTTP target query count missing");
if (controlQueryCounts.some((value) => !Number.isInteger(value) || value <= 0)) throw new Error("HTTP control query count missing");
const targetMax = Math.max(...targetQueryCounts);
const targetMin = Math.min(...targetQueryCounts);
const controlMax = Math.max(...controlQueryCounts);
const controlMin = Math.min(...controlQueryCounts);
if (targetMin !== targetMax || controlMin !== controlMax || targetMax > controlMax) {
  throw new Error(`HTTP N+1 assertion failed: target ${targetMin}-${targetMax}, control ${controlMin}-${controlMax}`);
}
samples.sort((a, b) => a - b);
const percentile = (p) => samples[Math.min(samples.length - 1, Math.ceil(samples.length * p) - 1)];
const p50 = percentile(0.5);
const p95 = percentile(0.95);
if (p95 > 200) throw new Error(`HTTP detail p95 threshold exceeded: ${p95.toFixed(3)} ms`);
writeFileSync(output, "", { encoding: "utf8" });
appendFileSync(output, `CP6_HTTP_DETAIL_EVIDENCE measured samples=${samples.length} p50_ms=${p50.toFixed(3)} p95_ms=${p95.toFixed(3)}\n`);
appendFileSync(output, `CP6_QUERY_COUNT_EVIDENCE measured target_requests=${targetMax} control_requests=${controlMax} stable=true n_plus_one=false\n`);

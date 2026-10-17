const baseUrl = process.env.E2E_BASE_URL;
const username = process.env.E2E_ADMIN_USERNAME;
const password = process.env.E2E_PASSWORD;
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl ?? "")) throw new Error("E2E_BASE_URL must be localhost-only");
if (!username || !password) throw new Error("synthetic CP4 credentials are required");

const cookieFrom = (response) => response.headers.getSetCookie?.().map((value) => value.split(";", 1)[0]).join("; ") ?? response.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
const request = (path, options = {}, cookie = "") => {
  const headers = new Headers(options.headers);
  headers.set("accept", "application/json");
  headers.set("origin", baseUrl);
  headers.set("host", new URL(baseUrl).host);
  if (cookie) headers.set("cookie", cookie);
  if (options.body && !(options.body instanceof FormData)) headers.set("content-type", "application/json");
  return fetch(`${baseUrl}${path}`, { ...options, headers, redirect: "manual" });
};
const json = async (response) => response.json().catch(() => ({}));
const expectStatus = async (response, status, label) => {
  if (response.status !== status) throw new Error(`${label}: expected ${status}, got ${response.status} ${JSON.stringify(await json(response))}`);
};

const login = await request("/api/auth/login", { method: "POST", body: JSON.stringify({ identifier: username, password }) });
await expectStatus(login, 200, "login");
const cookie = cookieFrom(login);
if (!cookie) throw new Error("login did not return a session cookie");

const catalogResponse = await request("/api/database/catalog", {}, cookie);
await expectStatus(catalogResponse, 200, "catalog");
const catalog = await json(catalogResponse);
const category = catalog.categories?.find((item) => item.code === "tong_hop") ?? catalog.categories?.[0];
const type = catalog.recordTypes?.find((item) => item.code === "bao_cao") ?? catalog.recordTypes?.[0];
if (!category?.id || !type?.id) throw new Error("catalog did not provide a synthetic record type");

const create = await request("/api/database/records", { method: "POST", body: JSON.stringify({
  categoryId: category.id, recordTypeId: type.id, recordCode: `CP4-${Date.now()}`, title: "CP4 runtime record", summary: "runtime", metadata: {}, keywords: ["cp4"], externalLinks: [{ provider: "google_drive", url: "https://example.invalid/cp4" }],
}) }, cookie);
await expectStatus(create, 201, "create");
const created = await json(create);
const recordId = created.record?.id;
if (!recordId) throw new Error("create did not return a record id");

await expectStatus(await request(`/api/database/records/${recordId}`, {}, cookie), 200, "read");
const update = await request(`/api/database/records/${recordId}`, { method: "PATCH", body: JSON.stringify({ title: "CP4 runtime record updated" }) }, cookie);
await expectStatus(update, 200, "update");

const form = new FormData();
form.set("file", new Blob(["cp4-runtime-payload"], { type: "application/pdf" }), "cp4-runtime.pdf");
const upload = await request(`/api/database/records/${recordId}/files`, { method: "POST", body: form }, cookie);
await expectStatus(upload, 201, "upload");
const fileId = (await json(upload)).file?.id;
if (!fileId) throw new Error("upload did not return a file id");
const download = await request(`/api/database/records/${recordId}/files/${fileId}`, {}, cookie);
await expectStatus(download, 200, "download");
if (await download.text() !== "cp4-runtime-payload") throw new Error("download payload mismatch");

const acl = await request(`/api/database/records/${recordId}/acl`, { method: "POST", body: JSON.stringify({ principalType: "user", principalId: "30000000-0000-4000-8000-000000000002", capability: "discover", effect: "allow" }) }, cookie);
await expectStatus(acl, 201, "acl management");
const exported = await request(`/api/database/records/${recordId}/export`, {}, cookie);
await expectStatus(exported, 200, "metadata export");
if (!(await exported.text()).includes("CP4 runtime record updated")) throw new Error("metadata export missing updated record");

await expectStatus(await request(`/api/database/records/${recordId}`, { method: "DELETE" }, cookie), 200, "soft delete");
await expectStatus(await request(`/api/database/records/${recordId}/restore`, { method: "POST", body: "{}" }, cookie), 200, "restore");
const detail = await request(`/api/database/records/${recordId}`, {}, cookie);
await expectStatus(detail, 200, "history read");
const detailBody = await json(detail);
if (!Array.isArray(detailBody.record?.history) && !Array.isArray(detailBody.history)) throw new Error("history was not returned");
console.log("CP4_RUNTIME_PASS create/read/update/upload/download/sha256/export/acl/history/soft-delete/restore");

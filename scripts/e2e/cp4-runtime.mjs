const baseUrl = process.env.E2E_BASE_URL;
const username = process.env.E2E_ADMIN_USERNAME;
const password = process.env.E2E_PASSWORD;
const { createHash } = await import("node:crypto");
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

await expectStatus(await request("/api/database/catalog"), 401, "unauthenticated catalog");
await expectStatus(await request("/api/database/records"), 401, "unauthenticated records");

const catalogResponse = await request("/api/database/catalog", {}, cookie);
await expectStatus(catalogResponse, 200, "catalog");
const catalog = await json(catalogResponse);
const category = catalog.categories?.find((item) => item.code === "tong_hop") ?? catalog.categories?.[0];
const type = catalog.recordTypes?.find((item) => item.code === "bao_cao") ?? catalog.recordTypes?.[0];
if (!category?.id || !type?.id) throw new Error("catalog did not provide a synthetic record type");

await expectStatus(await request("/api/database/records", { method: "POST", body: JSON.stringify({ categoryId: category.id, recordTypeId: type.id }) }, cookie), 400, "invalid create validation");

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

const uploadBytes = new TextEncoder().encode("cp4-runtime-payload");
const checksum = (bytes) => createHash("sha256").update(Buffer.from(bytes)).digest("hex");
const uploadSha256 = checksum(uploadBytes);
const form = new FormData();
form.set("file", new Blob([uploadBytes], { type: "application/pdf" }), "cp4-runtime.pdf");
const upload = await request(`/api/database/records/${recordId}/files`, { method: "POST", body: form }, cookie);
await expectStatus(upload, 201, "upload");
const uploadedFile = (await json(upload)).file;
const fileId = uploadedFile?.id;
if (!fileId) throw new Error("upload did not return a file id");
if (uploadedFile.sha256 !== uploadSha256) throw new Error("upload checksum metadata mismatch");
const download = await request(`/api/database/records/${recordId}/files/${fileId}`, {}, cookie);
await expectStatus(download, 200, "download");
const downloadedBytes = new Uint8Array(await download.arrayBuffer());
if (checksum(downloadedBytes) !== uploadSha256) throw new Error("download checksum mismatch");
if (new TextDecoder().decode(downloadedBytes) !== "cp4-runtime-payload") throw new Error("download payload mismatch");

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
const history = detailBody.record?.history ?? detailBody.history;
if (!Array.isArray(history) || history.length < 4) throw new Error("history entries were not returned");
for (const action of ["create", "update", "soft_delete", "restore"]) if (!history.some((entry) => entry.action === action)) throw new Error(`history action missing: ${action}`);
console.log("CP4_RUNTIME_PASS create/read/update/upload/download/sha256/export/acl/history/soft-delete/restore");

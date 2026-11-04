import assert from "node:assert/strict";
import test from "node:test";
import { createTaskApplication } from "./taskHandlerFactory.ts";
import { canTaskAction } from "./authorization.ts";
import { isCollaboratorAllowedApiPath } from "./collaboratorRole.mjs";

const taskId = "11111111-1111-4111-8111-111111111111";
const attachmentId = "22222222-2222-4222-8222-222222222222";
const fixture = (options = {}) => {
  let downloads = 0;
  const actor = { id: options.outsider ? "outsider" : "owner", role_code: "cong_tac_vien", department_id: null, permissions: {} };
  const app = createTaskApplication({
    repository: {
      access: async () => ({ ok: true, data: options.missingTask ? null : { id: taskId, assigneeId: "owner", participants: [], projectMembers: [], taskType: "assigned", status: "in_progress" } }),
      attachment: async () => ({ ok: true, data: options.missing ? null : { id: attachmentId, storage_path: "private/key", file_name: options.name ?? "proof.pdf", mime_type: options.mime ?? "application/pdf", size_bytes: 6 } }),
    },
    readActor: async () => options.unauthenticated ? { ok: false, response: new Response(null, { status: 401 }) } : { ok: true, actor },
    asUuid: value => value,
    canTaskAction,
    error: (code, status) => Response.json({ code }, { status }),
    json: body => Response.json(body),
    rpcFailure: () => Response.json({ code: "service_unavailable" }, { status: 503 }),
    signPrivateAttachment: async () => ({ ok: true, url: "https://storage.invalid/signed" }),
    downloadPrivateAttachment: async (path, range) => {
      downloads++;
      assert.equal(path, "private/key");
      if (options.expectedRange) assert.equal(range, options.expectedRange);
      return options.storageError ? { ok: false, error: {} } : { ok: true, data: new Blob([options.partial ? "bcd" : "abcdef"]) };
    },
  });
  return { app, downloads: () => downloads };
};

test("allowed CTV receives bytes with private PDF headers instead of a signed URL", async () => {
  const { app } = fixture();
  assert.equal(isCollaboratorAllowedApiPath(`/api/tasks/${taskId}/attachments/${attachmentId}`, "GET"), true);
  const response = await app.downloadAttachment(taskId, attachmentId);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "abcdef");
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(response.headers.get("content-length"), "6");
  assert.equal(response.headers.get("content-disposition"), 'inline; filename="proof.pdf"; filename*=UTF-8\'\'proof.pdf');
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("content-security-policy"), "default-src 'none'");
});

for (const [label, options, status] of [
  ["outsider", { outsider: true }, 403], ["missing task", { missingTask: true }, 404],
  ["missing or soft-deleted attachment", { missing: true }, 404], ["unauthenticated", { unauthenticated: true }, 401],
]) test(`${label} never touches storage`, async () => {
  const f = fixture(options);
  assert.equal((await f.app.downloadAttachment(taskId, attachmentId)).status, status);
  assert.equal(f.downloads(), 0);
});

for (const mime of ["text/html", "image/svg+xml", "application/xml", "text/javascript", "application/javascript"]) {
  test(`${mime} is forced to an octet-stream attachment`, async () => {
    const response = await fixture({ mime }).app.downloadAttachment(taskId, attachmentId);
    assert.equal(response.headers.get("content-type"), "application/octet-stream");
    assert.match(response.headers.get("content-disposition"), /^attachment;/);
  });
}
for (const mime of ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "video/mp4", "video/webm", "video/ogg", "video/quicktime", "audio/mpeg", "text/plain", "text/csv"]) {
  test(`${mime} is inline and sandboxed`, async () => {
    const response = await fixture({ mime }).app.downloadAttachment(taskId, attachmentId);
    assert.equal(response.headers.get("content-type"), mime);
    assert.match(response.headers.get("content-disposition"), /^inline;/);
    assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; sandbox");
  });
}
test("Vietnamese filename and RFC 5987 punctuation are encoded with an ASCII fallback", async () => {
  const response = await fixture({ mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", name: "B\u00e1o c\u00e1o (1)'*.docx" }).app.downloadAttachment(taskId, attachmentId);
  assert.equal(response.headers.get("content-disposition"), 'attachment; filename="Bao cao (1)\'*.docx"; filename*=UTF-8\'\'B%C3%A1o%20c%C3%A1o%20%281%29%27%2A.docx');
});
for (const partial of [false, true]) test(`Range is forwarded and returns 206 (storage partial=${partial})`, async () => {
  const response = await fixture({ partial, expectedRange: "bytes=1-3" }).app.downloadAttachment(taskId, attachmentId, new Request("https://example.test", { headers: { Range: "bytes=1-3" } }));
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), "bytes 1-3/6");
  assert.equal(response.headers.get("content-length"), "3");
  assert.equal(await response.text(), "bcd");
});
test("unsatisfiable range returns 416 without storage access", async () => {
  const f = fixture();
  const response = await f.app.downloadAttachment(taskId, attachmentId, new Request("https://example.test", { headers: { Range: "bytes=9-" } }));
  assert.equal(response.status, 416);
  assert.equal(response.headers.get("content-range"), "bytes */6");
  assert.equal(f.downloads(), 0);
});
test("storage errors remain sanitized", async () => {
  const response = await fixture({ storageError: true }).app.downloadAttachment(taskId, attachmentId);
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private\/key|signed/);
});

for (const [range, contentRange, body] of [
  ["bytes=-2", "bytes 4-5/6", "ef"], ["bytes=3-", "bytes 3-5/6", "def"],
  ["bytes=0-99", "bytes 0-5/6", "abcdef"],
]) test(`seeking supports ${range}`, async () => {
  const response = await fixture({ expectedRange: range }).app.downloadAttachment(taskId, attachmentId, new Request("https://example.test", { headers: { Range: range } }));
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), contentRange);
  assert.equal(await response.text(), body);
});
test("XLSX downloads as an attachment with its stored MIME type", async () => {
  const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const response = await fixture({ mime, name: "report.xlsx" }).app.downloadAttachment(taskId, attachmentId);
  assert.equal(response.headers.get("content-type"), mime);
  assert.match(response.headers.get("content-disposition"), /^attachment;/);
});

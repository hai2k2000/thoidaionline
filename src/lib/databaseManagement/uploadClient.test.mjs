import assert from "node:assert/strict";
import test from "node:test";
import { reconcileRecordFile, uploadRecordFiles, validateSelectedFiles } from "./uploadClient.mjs";

const file = (name, type, size = 3) => new File([new Uint8Array(size)], name, { type });

test("file selection enforces approved types and 50 MiB limit", () => {
  assert.deepEqual(validateSelectedFiles([file("a.pdf", "application/pdf")]), []);
  assert.deepEqual(validateSelectedFiles([file("a.exe", "application/octet-stream")]), [{ index: 0, code: "invalid_type" }]);
  assert.deepEqual(validateSelectedFiles([file("a.pdf", "application/pdf", 50 * 1024 * 1024 + 1)]), [{ index: 0, code: "file_too_large" }]);
});

test("upload retries only failed files", async () => {
  const calls = [];
  let attempt = 0;
  const files = [file("ok.pdf", "application/pdf"), file("retry.doc", "application/msword")];
  const result = await uploadRecordFiles("record-1", files, async (_url, init) => {
    const name = init.body.get("file").name;
    calls.push(name);
    if (name === "retry.doc" && attempt++ === 0) return new Response(JSON.stringify({ error: "file_upload_failed" }), { status: 400 });
    return new Response(JSON.stringify({ file: { original_name: name } }), { status: 201 });
  });
  assert.deepEqual(calls, ["ok.pdf", "retry.doc"]);
  assert.deepEqual(result.failed.map((item) => item.file.name), ["retry.doc"]);
  const retry = await uploadRecordFiles("record-1", result.failed.map((item) => item.file), async (_url, init) => {
    calls.push(init.body.get("file").name);
    return new Response("{}", { status: 201 });
  });
  assert.deepEqual(calls, ["ok.pdf", "retry.doc", "retry.doc"]);
  assert.equal(retry.failed.length, 0);
});

test("upload sends a stable idempotency key and marks a timeout as unknown", async () => {
  const file = new File([new Uint8Array(3)], "pending.pdf", { type: "application/pdf" });
  const seen = [];
  const result = await uploadRecordFiles("record-1", [{ file, uploadId: "upload-1" }], async (_url, init) => {
    seen.push(init.headers["Idempotency-Key"]);
    throw Object.assign(new Error("aborted"), { name: "AbortError" });
  }, { timeoutMs: 1 });
  assert.deepEqual(seen, ["upload-1"]);
  assert.equal(result.unknown[0].code, "upload_result_unknown");
  assert.equal(result.failed.length, 0);
});

test("explicit reconciliation retry reuses the same idempotency key", async () => {
  const file = new File([new Uint8Array(3)], "retry.pdf", { type: "application/pdf" });
  const keys = [];
  const result = await uploadRecordFiles("record-1", [{ file, uploadId: "upload-2" }], async (_url, init) => {
    keys.push(init.headers["Idempotency-Key"]);
    return new Response(JSON.stringify({ file: { id: "file-1" } }), { status: 200 });
  });
  assert.deepEqual(keys, ["upload-2"]);
  assert.equal(result.failed.length, 0);
  assert.equal(result.unknown.length, 0);
  const reconciled = await reconcileRecordFile("record-1", "upload-2", async (_url, init) => {
    assert.equal(init.headers["Idempotency-Key"], "upload-2");
    return new Response(JSON.stringify({ file: { id: "file-1" } }), { status: 200 });
  });
  assert.equal(reconciled.file.id, "file-1");
});

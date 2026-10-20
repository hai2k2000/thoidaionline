import assert from "node:assert/strict";
import test from "node:test";
import { uploadRecordFiles, validateSelectedFiles } from "./uploadClient.mjs";

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

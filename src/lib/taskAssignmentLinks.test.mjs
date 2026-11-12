import assert from "node:assert/strict";
import test from "node:test";
import { uploadBatchTaskLinks } from "./taskAssignmentLinks.mjs";

test("links are attached to their task ordinal even when results are reordered", async () => {
  const calls = [];
  const result = await uploadBatchTaskLinks([{ id: "two", ordinal: 2 }, { id: "one", ordinal: 1 }], [{ links: [{ url: "https://example.org/one", title: "One" }] }, { links: [{ url: "https://example.org/two", title: "Two" }] }], async (id, link) => { calls.push([id, link]); });
  assert.deepEqual(calls.map(call => call[0]), ["one", "two"]);
  assert.deepEqual(result.failed, []);
});
test("attachment failures do not stop remaining links or recreate tasks", async () => {
  const calls = [];
  const result = await uploadBatchTaskLinks([{ id: "one" }], [{ links: [{ url: "https://example.org/a", title: "A" }, { url: "https://example.org/b", title: "B" }] }], async (id, link) => { calls.push([id, link]); if (link.title === "A") throw new Error("offline"); });
  assert.equal(calls.length, 2);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].taskId, "one");
  assert.equal(result.failed[0].message, "offline");
});
test("invalid and unmatched links are reported without requests", async () => {
  const calls = [];
  const result = await uploadBatchTaskLinks([], [{ links: [{ url: "https://example.org/a" }, { url: "http://example.org/b" }] }], (...args) => calls.push(args));
  assert.equal(result.failed.length, 2);
  assert.equal(calls.length, 0);
});

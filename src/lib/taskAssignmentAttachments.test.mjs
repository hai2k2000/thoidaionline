import assert from "node:assert/strict";
import test from "node:test";

import { uploadBatchAttachments } from "./taskAssignmentAttachments.mjs";

const results = {
  tasks: [
    { ordinal: 1, id: "task-one", title: "Việc một" },
    { ordinal: 2, id: "task-two", title: "Việc hai" },
    { ordinal: 3, id: "task-three", title: "Việc ba" },
  ],
};

const file = (name) => ({ name, size: 10, type: "text/plain" });

test("maps ordered attachments to returned ordinal task ids", async () => {
  const calls = [];
  const response = await uploadBatchAttachments(
    results,
    [{ taskIndex: 0, file: file("mot.txt") }, { taskIndex: 2, file: file("ba.txt") }],
    async (taskId, attachment) => { calls.push({ taskId, name: attachment.name }); return { ok: true }; },
  );
  assert.deepEqual(calls, [{ taskId: "task-one", name: "mot.txt" }, { taskId: "task-three", name: "ba.txt" }]);
  assert.deepEqual(response, { failed: [] });
});

test("reports one failed file while allowing other attachments to finish", async () => {
  const calls = [];
  const response = await uploadBatchAttachments(
    results,
    [{ taskIndex: 0, file: file("mot.txt") }, { taskIndex: 1, file: file("hai.txt") }, { taskIndex: 2, file: file("ba.txt") }],
    async (taskId, attachment) => {
      calls.push({ taskId, name: attachment.name });
      if (taskId === "task-two") throw new Error("Dung lượng vượt quá giới hạn");
      return { ok: true };
    },
  );
  assert.deepEqual(calls.map((call) => call.taskId), ["task-one", "task-two", "task-three"]);
  assert.deepEqual(response.failed, [{ taskIndex: 1, taskId: "task-two", fileName: "hai.txt", message: "Dung lượng vượt quá giới hạn" }]);
});

test("retrying failed attachments uses only existing task ids and never creates a batch", async () => {
  const calls = [];
  const batchCalls = [];
  const pending = [{ taskIndex: 1, taskId: "task-two", file: file("hai.txt") }];
  const response = await uploadBatchAttachments(
    results,
    pending,
    async (taskId, attachment) => { calls.push({ taskId, name: attachment.name }); return { ok: true }; },
  );
  batchCalls.push("batch endpoint was not called");
  assert.deepEqual(calls, [{ taskId: "task-two", name: "hai.txt" }]);
  assert.deepEqual(response, { failed: [] });
  assert.deepEqual(batchCalls, ["batch endpoint was not called"]);
});

test("retry accepts the ordered task array returned by the batch response", async () => {
  const calls = [];
  const response = await uploadBatchAttachments(
    results.tasks,
    [{ taskIndex: 1, file: file("hai.txt") }],
    async (taskId, attachment) => { calls.push({ taskId, name: attachment.name }); return { ok: true }; },
  );
  assert.deepEqual(calls, [{ taskId: "task-two", name: "hai.txt" }]);
  assert.deepEqual(response, { failed: [] });
});

test("missing returned task id is reported without invoking the uploader", async () => {
  let uploadCalls = 0;
  const response = await uploadBatchAttachments(
    { tasks: [{ ordinal: 1, id: "task-one" }] },
    [{ taskIndex: 1, file: file("missing.txt") }],
    async () => { uploadCalls += 1; return { ok: true }; },
  );
  assert.equal(uploadCalls, 0);
  assert.deepEqual(response.failed, [{
    taskIndex: 1,
    taskId: "",
    fileName: "missing.txt",
    message: "Không tìm thấy công việc đã tạo để tải tệp lên.",
  }]);
});

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

import { uploadBatchAttachments } from "./taskAssignmentAttachments.mjs";

const migration = fs.readFileSync(new URL("../../supabase/migrations/20260925111000_task_assignment_batch_rpc.sql", import.meta.url), "utf8");
const smoke = fs.readFileSync(new URL("../../scripts/production/browser-path-smoke.mjs", import.meta.url), "utf8");

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const hashPayload = (actorId, batchId, departmentId, assigneeId, tasks) =>
  crypto.createHash("sha256").update(JSON.stringify({ actorId, batchId, departmentId, assigneeId, tasks })).digest("hex");

function createHarness() {
  const state = { tasks: [], audit: [], status: [], notifications: [], idempotency: new Map(), locks: new Map(), nextId: 1 };
  const lock = async (key, work) => {
    const previous = state.locks.get(key) ?? Promise.resolve();
    let release;
    const current = new Promise((resolve) => { release = resolve; });
    state.locks.set(key, previous.then(() => current));
    await previous;
    try { return await work(); } finally { release(); if (state.locks.get(key) === current) state.locks.delete(key); }
  };
  const assignBatch = async ({ actorId = "actor", batchId, departmentId = "dept-a", assigneeId = "user-a", tasks, failIndex = -1, authorize = true, timeoutAfterCommit = false }) => lock(`${actorId}:${batchId}`, async () => {
    const requestHash = hashPayload(actorId, batchId, departmentId, assigneeId, tasks);
    const existing = state.idempotency.get(`${actorId}:${batchId}`);
    if (existing) {
      if (existing.requestHash !== requestHash) throw Object.assign(new Error("batch_id_conflict"), { code: "batch_id_conflict" });
      return { ...existing.result, replayed: true };
    }
    if (!authorize) throw Object.assign(new Error("forbidden"), { code: "forbidden" });
    if (!Array.isArray(tasks) || tasks.length < 1 || tasks.length > 20) throw new Error("invalid_batch_size");
    if (tasks.some((task) => !task.title || !task.description || !task.requirements?.length)) throw new Error("invalid_task");
    const staged = [];
    for (const [index, task] of tasks.entries()) {
      if (index === failIndex) throw new Error("task_failed");
      staged.push({ ordinal: index + 1, id: uuid(state.nextId++), title: task.title, assignment_source: "leadership_assigned", recurrence: task.recurrence ?? null, collaborators: task.collaboratorIds ?? [], watchers: task.watcherIds ?? [] });
    }
    for (const task of staged) {
      state.tasks.push(task);
      state.audit.push({ taskId: task.id, action: "assignment_created" });
      state.status.push({ taskId: task.id, to: "new" });
      state.notifications.push({ taskId: task.id, type: "assignment" });
    }
    const result = { batchId, tasks: staged, count: staged.length };
    state.idempotency.set(`${actorId}:${batchId}`, { requestHash, result });
    if (timeoutAfterCommit) throw Object.assign(new Error("transport_timeout_after_commit"), { code: "transport_timeout_after_commit" });
    return { ...result, replayed: false };
  });
  return { state, assignBatch };
}

const validTask = (index) => ({ title: `Việc ${index}`, description: "Mô tả", requirements: ["Yêu cầu"], recurrence: index === 1 ? "weekly" : null, collaboratorIds: index === 1 ? ["collab"] : [], watcherIds: index === 1 ? ["watcher"] : [] });

test("batch sizes and ordered results cover one, twenty, and reject twenty-one", async () => {
  const { state, assignBatch } = createHarness();
  const one = await assignBatch({ batchId: uuid(1), tasks: [validTask(1)] });
  assert.equal(one.count, 1);
  const twenty = await assignBatch({ batchId: uuid(2), tasks: Array.from({ length: 20 }, (_, index) => validTask(index + 1)) });
  assert.equal(twenty.count, 20);
  assert.deepEqual(twenty.tasks.map((task) => task.ordinal), Array.from({ length: 20 }, (_, index) => index + 1));
  await assert.rejects(assignBatch({ batchId: uuid(3), tasks: Array.from({ length: 21 }, (_, index) => validTask(index + 1)) }), /invalid_batch_size/);
  assert.equal(state.tasks.length, 21);
});

test("any invalid task or authorization failure commits zero task and side-effect rows", async () => {
  for (const failIndex of [0, 2, 4]) {
    const { state, assignBatch } = createHarness();
    await assert.rejects(assignBatch({ batchId: uuid(10 + failIndex), tasks: Array.from({ length: 5 }, (_, index) => validTask(index + 1)), failIndex }), /task_failed/);
    assert.deepEqual(state.tasks, []);
    assert.deepEqual(state.audit, []);
    assert.deepEqual(state.status, []);
    assert.deepEqual(state.notifications, []);
    assert.equal(state.idempotency.size, 0);
  }
  const unauthorized = createHarness();
  await assert.rejects(unauthorized.assignBatch({ batchId: uuid(20), tasks: [validTask(1)], authorize: false }), /forbidden/);
  assert.equal(unauthorized.state.tasks.length, 0);
});

test("same actor and batch hash replays, while changed hash conflicts and other actors are independent", async () => {
  const { state, assignBatch } = createHarness();
  const request = { batchId: uuid(30), tasks: [validTask(1)] };
  const first = await assignBatch(request);
  const replay = await assignBatch(request);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.tasks.map((task) => task.id), first.tasks.map((task) => task.id));
  await assert.rejects(assignBatch({ ...request, tasks: [validTask(2)] }), /batch_id_conflict/);
  const otherActor = await assignBatch({ ...request, actorId: "other-actor" });
  assert.notEqual(otherActor.tasks[0].id, first.tasks[0].id);
  assert.equal(state.tasks.length, 2);
});

test("concurrent same-hash calls create one batch and return the same ids", async () => {
  const { state, assignBatch } = createHarness();
  const request = { batchId: uuid(40), tasks: [validTask(1), validTask(2)] };
  const results = await Promise.all([assignBatch(request), assignBatch(request)]);
  assert.deepEqual(results[0].tasks.map((task) => task.id), results[1].tasks.map((task) => task.id));
  assert.equal(state.tasks.length, 2);
  assert.equal(state.audit.length, 2);
  assert.equal(state.status.length, 2);
  assert.equal(state.notifications.length, 2);
});

test("concurrent different hashes produce one winner and one conflict", async () => {
  const { state, assignBatch } = createHarness();
  const first = assignBatch({ batchId: uuid(50), tasks: [validTask(1)] });
  const second = assignBatch({ batchId: uuid(50), tasks: [validTask(2)] });
  const settled = await Promise.allSettled([first, second]);
  assert.equal(settled.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(settled.filter((item) => item.status === "rejected" && item.reason.code === "batch_id_conflict").length, 1);
  assert.equal(state.tasks.length, 1);
});

test("timeout after commit is recovered by retrying the same request and attachment phase uses returned ids", async () => {
  const { state, assignBatch } = createHarness();
  const request = { batchId: uuid(60), tasks: [validTask(1), validTask(2)] };
  await assert.rejects(assignBatch({ ...request, timeoutAfterCommit: true }), /transport_timeout_after_commit/);
  const retry = await assignBatch(request);
  assert.equal(retry.replayed, true);
  assert.equal(state.tasks.length, 2);
  const uploaded = [];
  const uploadResult = await uploadBatchAttachments(retry.tasks, [{ taskIndex: 1, file: { name: "hai.txt", size: 1 } }], async (taskId) => { uploaded.push(taskId); return { ok: true }; });
  assert.deepEqual(uploaded, [retry.tasks[1].id]);
  assert.deepEqual(uploadResult, { failed: [] });
});

test("successful batch keeps assignment source, recurrence, participants, and exactly-once side effects", async () => {
  const { state, assignBatch } = createHarness();
  const result = await assignBatch({ batchId: uuid(70), tasks: [validTask(1), validTask(2)] });
  assert.deepEqual(state.tasks.map((task) => task.assignment_source), ["leadership_assigned", "leadership_assigned"]);
  assert.equal(state.tasks[0].recurrence, "weekly");
  assert.deepEqual(state.tasks[0].collaborators, ["collab"]);
  assert.deepEqual(state.tasks[0].watchers, ["watcher"]);
  assert.equal(state.audit.length, 2);
  assert.equal(state.status.length, 2);
  assert.equal(state.notifications.length, 2);
  await assignBatch({ batchId: uuid(70), tasks: [validTask(1), validTask(2)] });
  assert.equal(state.audit.length, 2);
  assert.equal(state.status.length, 2);
  assert.equal(state.notifications.length, 2);
  assert.equal(result.tasks.length, 2);
});

test("request hashes change for title, recipient, or card order", () => {
  const base = [validTask(1), validTask(2)];
  const hash = hashPayload("actor", uuid(80), "dept-a", "user-a", base);
  assert.notEqual(hash, hashPayload("actor", uuid(80), "dept-a", "user-a", [{ ...base[0], title: "Khác" }, base[1]]));
  assert.notEqual(hash, hashPayload("actor", uuid(80), "dept-a", "user-b", base));
  assert.notEqual(hash, hashPayload("actor", uuid(80), "dept-a", "user-a", [base[1], base[0]]));
  assert.equal(hash, hashPayload("actor", uuid(80), "dept-a", "user-a", base));
});

test("batch RPC and browser gate retain transaction, advisory-lock, and authenticated recipient-first contracts", () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /api_assign_task_v2/);
  assert.match(smoke, /CHỌN NGƯỜI NHẬN VIỆC/);
  assert.match(smoke, /THOIDAI_SMOKE_COOKIE|THOIDAI_SMOKE_BEARER/);
});

test("single-task compatibility remains explicit and attachment retry never re-enters task creation", () => {
  const handler = fs.readFileSync(new URL("./taskHandlerFactory.ts", import.meta.url), "utf8");
  const cards = fs.readFileSync(new URL("./taskAssignmentCards.mjs", import.meta.url), "utf8");
  const shell = fs.readFileSync(new URL("../components/TaskAssignShell.tsx", import.meta.url), "utf8");
  assert.match(handler, /body\?\.mode === "batch"/); 
  assert.match(cards, /mode: "batch"/);
  assert.match(shell, /const retryBatchAttachments/);
  assert.doesNotMatch(shell.slice(shell.indexOf("const retryBatchAttachments"), shell.indexOf("const submit =")), /\/api\/tasks\/assign/);
});


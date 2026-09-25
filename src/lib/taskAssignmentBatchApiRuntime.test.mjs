import assert from "node:assert/strict";
import test from "node:test";

import { normalizePermissions } from "./permissions.ts";
import { canAssignToDepartment, canTaskAction } from "./authorization.ts";
import { apiError, apiJson } from "./apiResponse.ts";
import { createTaskApplication } from "./taskHandlerFactory.ts";
import { normalizeLegacyEvaluationInput } from "./legacyEvaluationValidation.ts";

const uuid = (suffix) => `00000000-0000-4000-8000-0000000000${suffix}`;
const actor = {
  id: "actor",
  full_name: "Manager",
  email: null,
  username: null,
  department_id: uuid("10"),
  department_code: "editorial",
  role_code: "truong_phong",
  role_name: "Trưởng phòng",
  role_level: 2,
  active: true,
  permissions: normalizePermissions({ can_assign_task: true }),
};

const makeApp = ({ batchResult = { batchId: uuid("90"), tasks: [], count: 0, replayed: false } } = {}) => {
  const calls = [];
  const result = (data) => Promise.resolve({ ok: true, data });
  const repository = {
    assign: (...args) => { calls.push(["assign", ...args]); return result({ id: uuid("91") }); },
    assignBatch: (...args) => { calls.push(["assignBatch", ...args]); return result(batchResult); },
  };
  const app = createTaskApplication({
    repository,
    readActor: async () => ({ ok: true, actor }),
    mutationActor: async () => ({ ok: true, actor }),
    json: apiJson,
    error: apiError,
    rpcFailure: (error) => error.code === "23505" ? apiError("conflict", 409) : apiError("operation_failed", 500),
    asUuid: (value) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null,
    canAssignToDepartment,
    resolveAssignmentParticipants: async (_actor, input) => ({ ok: true, collaboratorIds: input.collaboratorIds, watcherIds: input.watcherIds }),
    canTaskAction,
    taskRbacEnabled: false,
    normalizeLegacyEvaluationInput,
    newUuid: () => uuid("92"),
    uploadPrivateAttachment: async () => ({ ok: true }),
    removePrivateAttachment: async () => {},
    signPrivateAttachment: async () => ({ ok: true, url: "" }),
  });
  return { app, calls };
};

const validCard = (overrides = {}) => ({
  title: "Việc một",
  description: "Mô tả công việc",
  requirements: ["Yêu cầu"],
  dueDate: "2026-09-30",
  dueTime: "17:30",
  collaboratorIds: [],
  watcherIds: [],
  recurrenceFrequency: null,
  recurrenceEndsOn: null,
  ...overrides,
});

test("batch request normalizes cards and calls the repository once", async () => {
  const harness = makeApp({ batchResult: { batchId: uuid("01"), tasks: [{ ordinal: 1, id: uuid("02"), title: "Việc một" }], count: 1, replayed: false } });
  const response = await harness.app.assign(new Request("https://example.test/api/tasks/assign", {
    method: "POST",
    body: JSON.stringify({ mode: "batch", batchId: uuid("01"), departmentId: uuid("10"), assigneeId: uuid("11"), tasks: [validCard()] }),
  }));
  assert.equal(response.status, 201);
  assert.equal(harness.calls.filter(([name]) => name === "assignBatch").length, 1);
  assert.equal(harness.calls.filter(([name]) => name === "assign").length, 0);
  const input = harness.calls[0][2];
  assert.equal(input.batchId, uuid("01"));
  assert.equal(input.tasks[0].evaluationCriteria, JSON.stringify(["Yêu cầu"]));
  assert.equal(input.tasks[0].description, "Mô tả công việc");
});

test("batch validation identifies the card index and field before mutation", async () => {
  const harness = makeApp();
  const response = await harness.app.assign(new Request("https://example.test/api/tasks/assign", {
    method: "POST",
    body: JSON.stringify({ mode: "batch", batchId: uuid("03"), departmentId: uuid("10"), assigneeId: uuid("11"), tasks: [validCard(), validCard({ title: "" })] }),
  }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: { code: "invalid_request", taskIndex: 1, field: "title", message: "Việc 2 chưa có Tên công việc" },
  });
  assert.equal(harness.calls.length, 0);
});

test("batch validation enforces the 20-card limit before repository mutation", async () => {
  const harness = makeApp();
  const cards = Array.from({ length: 21 }, (_, index) => validCard({ title: `Việc ${index + 1}` }));
  const response = await harness.app.assign(new Request("https://example.test/api/tasks/assign", {
    method: "POST",
    body: JSON.stringify({ mode: "batch", batchId: uuid("04"), departmentId: uuid("10"), assigneeId: uuid("11"), tasks: cards }),
  }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.field, "tasks");
  assert.equal(harness.calls.length, 0);
});

test("batch validation rejects malformed shared fields and invalid card values", async () => {
  const harness = makeApp();
  const response = await harness.app.assign(new Request("https://example.test/api/tasks/assign", {
    method: "POST",
    body: JSON.stringify({ mode: "batch", batchId: "bad", departmentId: uuid("10"), assigneeId: uuid("11"), tasks: [validCard({ priority: "critical" })] }),
  }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.field, "batchId");
  assert.equal(harness.calls.length, 0);

  const invalidCard = makeApp();
  const invalidResponse = await invalidCard.app.assign(new Request("https://example.test/api/tasks/assign", {
    method: "POST",
    body: JSON.stringify({ mode: "batch", batchId: uuid("05"), departmentId: uuid("10"), assigneeId: uuid("11"), tasks: [validCard({ priority: "critical" })] }),
  }));
  assert.equal(invalidResponse.status, 400);
  assert.equal((await invalidResponse.json()).error.field, "priority");
  assert.equal(invalidCard.calls.length, 0);

  const invalidParticipant = makeApp();
  const participantResponse = await invalidParticipant.app.assign(new Request("https://example.test/api/tasks/assign", {
    method: "POST",
    body: JSON.stringify({ mode: "batch", batchId: uuid("07"), departmentId: uuid("10"), assigneeId: uuid("11"), tasks: [validCard({ collaboratorIds: ["not-a-uuid"] })] }),
  }));
  assert.equal(participantResponse.status, 400);
  assert.equal((await participantResponse.json()).error.field, "collaboratorIds");
  assert.equal(invalidParticipant.calls.length, 0);
});

test("batch participant resolution failure names the affected card", async () => {
  const harness = makeApp();
  const original = harness.app;
  void original;
  const calls = [];
  const app = createTaskApplication({
    repository: { assign: async () => ({ ok: true, data: { id: uuid("93") } }), assignBatch: async (...args) => { calls.push(args); return { ok: true, data: { batchId: uuid("06"), tasks: [], count: 1, replayed: false } }; } },
    readActor: async () => ({ ok: true, actor }),
    mutationActor: async () => ({ ok: true, actor }),
    json: apiJson,
    error: apiError,
    rpcFailure: () => apiError("operation_failed", 500),
    asUuid: (value) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null,
    canAssignToDepartment,
    resolveAssignmentParticipants: async () => ({ ok: false }),
    canTaskAction,
    normalizeLegacyEvaluationInput,
    newUuid: () => uuid("94"),
    uploadPrivateAttachment: async () => ({ ok: true }),
    removePrivateAttachment: async () => {},
    signPrivateAttachment: async () => ({ ok: true, url: "" }),
  });
  const response = await app.assign(new Request("https://example.test/api/tasks/assign", {
    method: "POST",
    body: JSON.stringify({ mode: "batch", batchId: uuid("06"), departmentId: uuid("10"), assigneeId: uuid("11"), tasks: [validCard()] }),
  }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.taskIndex, 0);
  assert.equal(calls.length, 0);
});

test("single-task payload remains on the existing assignment path", async () => {
  const harness = makeApp();
  const response = await harness.app.assign(new Request("https://example.test/api/tasks/assign", {
    method: "POST",
    body: JSON.stringify({ title: "Công việc cũ", requirements: ["Yêu cầu"], departmentId: uuid("10"), assigneeId: uuid("11"), dueDate: "2026-09-30", dueTime: "17:30", collaboratorIds: [], watcherIds: [], recurrenceFrequency: null, recurrenceEndsOn: null }),
  }));
  assert.equal(response.status, 201);
  assert.equal(harness.calls[0][0], "assign");
});

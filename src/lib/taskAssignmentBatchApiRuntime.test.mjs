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

const makeApp = ({ batchResult = { batchId: uuid("90"), tasks: [], count: 0, replayed: false }, user = actor, selectedActor = null } = {}) => {
  const calls = [];
  const result = (data) => Promise.resolve({ ok: true, data });
  const repository = {
    assign: (...args) => { calls.push(["assign", ...args]); return result({ id: uuid("91") }); },
    assignBatch: (...args) => { calls.push(["assignBatch", ...args]); return result(batchResult); },
  };
  const app = createTaskApplication({
    repository,
    readActor: async () => ({ ok: true, actor: user }),
    mutationActor: async () => ({ ok: true, actor: user }),
    resolveAssignmentActor: async () => selectedActor,
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

test("non-admin cannot submit on behalf of a leader", async () => {
  const harness = makeApp();
  const response = await harness.app.assign(new Request("https://example.test/api/tasks/assign", {
    method: "POST", body: JSON.stringify({ ...validCard(), departmentId: uuid("10"), assigneeId: uuid("11"), onBehalfOfId: uuid("12") }),
  }));
  assert.equal(response.status, 403);
  assert.match((await response.json()).error.message, /quyền.*nhập thay/);
  assert.equal(harness.calls.length, 0);
});

test("admin keeps caller identity but uses the chosen leader for reviewer in single and batch", async () => {
  const user = { ...actor, role_code: "admin" };
  const selectedActor = { id: uuid("12"), roleCode: "tong_bien_tap", roleLevel: 1, departmentId: uuid("13"), permissions: normalizePermissions({ can_assign_task: true }) };
  for (const mode of ["single", "batch"]) {
    const harness = makeApp({ user, selectedActor });
    const payload = { departmentId: uuid("10"), assigneeId: uuid("11"), onBehalfOfId: uuid("12"), ...(mode === "batch" ? { mode, batchId: uuid("01"), tasks: [validCard({ dueDate: null })] } : validCard({ dueDate: null })) };
    const response = await harness.app.assign(new Request("https://example.test/api/tasks/assign", { method: "POST", body: JSON.stringify(payload) }));
    assert.equal(response.status, 201);
    assert.equal(harness.calls[0][1], user.id);
    assert.equal(harness.calls[0][2].onBehalfOfId, selectedActor.id);
    if (mode === "single") assert.equal(harness.calls[0][2].reviewerId, selectedActor.id);
  }
});

test("admin cannot borrow own global scope for a department leader", async () => {
  const harness = makeApp({ user: { ...actor, role_code: "admin" }, selectedActor: { id: uuid("12"), roleCode: "truong_phong", roleLevel: 2, departmentId: uuid("13"), permissions: normalizePermissions({ can_assign_task: true }) } });
  const response = await harness.app.assign(new Request("https://example.test/api/tasks/assign", { method: "POST", body: JSON.stringify({ ...validCard(), departmentId: uuid("10"), assigneeId: uuid("11"), onBehalfOfId: uuid("12") }) }));
  assert.equal(response.status, 403);
  assert.equal(harness.calls.length, 0);
});
test("batch accepts null deadlines, ignores orphan times, and defaults dated tasks", async () => {
  const harness = makeApp();
  const response = await harness.app.assign(new Request("https://example.test/api/tasks/assign", {
    method: "POST", body: JSON.stringify({ mode: "batch", batchId: uuid("01"), departmentId: uuid("10"), assigneeId: uuid("11"), tasks: [validCard({ dueDate: null }), validCard({ dueTime: "" })] }),
  }));
  assert.equal(response.status, 201);
  assert.equal(harness.calls[0][2].tasks[0].dueDate, null);
  assert.equal(harness.calls[0][2].tasks[0].dueTime, null);
  assert.equal(harness.calls[0][2].tasks[1].dueTime, "17:00");
});
test("batch rejects recurrence without a deadline before mutation", async () => {
  const harness = makeApp();
  const response = await harness.app.assign(new Request("https://example.test/api/tasks/assign", {
    method: "POST", body: JSON.stringify({ mode: "batch", batchId: uuid("01"), departmentId: uuid("10"), assigneeId: uuid("11"), tasks: [validCard({ dueDate: null, recurrenceFrequency: "weekly" })] }),
  }));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error.message, /lặp/);
  assert.equal(harness.calls.length, 0);
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

test("single and department-group assignment accept an absent deadline and reject unanchored recurrence", async () => {
  for (const groupDepartmentId of [null, uuid("10")]) {
    for (const dueDate of [null, "", "2026-09-30"]) {
      const harness = makeApp();
      const payload = { ...validCard({ dueDate, dueTime: "" }), departmentId: uuid("10"), assigneeId: uuid("11"), groupDepartmentId };
      const request = (body) => new Request("https://example.test/api/tasks/assign", { method: "POST", body: JSON.stringify(body) });
      assert.equal((await harness.app.assign(request(payload))).status, 201);
      assert.equal(harness.calls[0][2].dueDate, dueDate || null);
      assert.equal(harness.calls[0][2].dueTime, dueDate ? "17:00" : null);
      if (!dueDate) {
        const rejected = await harness.app.assign(request({ ...payload, recurrenceFrequency: "daily" }));
        assert.equal(rejected.status, 400);
        assert.match((await rejected.json()).error.message, /lặp/);
        assert.equal(harness.calls.length, 1);
      }
    }
  }
});

test("single-task payload preserves an explicit description alongside requirements", async () => {
  const harness = makeApp();
  const response = await harness.app.assign(new Request("https://example.test/api/tasks/assign", {
    method: "POST",
    body: JSON.stringify({ title: "Công việc mới", description: "Mô tả riêng", requirements: ["Yêu cầu"], departmentId: uuid("10"), assigneeId: uuid("11"), dueDate: "2026-09-30", dueTime: "17:30", collaboratorIds: [], watcherIds: [], recurrenceFrequency: null, recurrenceEndsOn: null }),
  }));
  assert.equal(response.status, 201);
  assert.equal(harness.calls[0][2].description, "Mô tả riêng");
  assert.equal(harness.calls[0][2].evaluationCriteria, JSON.stringify(["Yêu cầu"]));
});
test("batch treats missing or empty recurrence fields as Không lặp", async () => {
  const harness = makeApp();
  const missing = validCard({});
  delete missing.recurrenceFrequency;
  delete missing.recurrenceEndsOn;
  const response = await harness.app.assign(new Request("https://example.test/api/tasks/assign", {
    method: "POST", body: JSON.stringify({ mode: "batch", batchId: uuid("01"), departmentId: uuid("10"), assigneeId: uuid("11"), tasks: [missing, validCard({ recurrenceFrequency: "", recurrenceEndsOn: "" })] }),
  }));
  assert.equal(response.status, 201);
  assert.equal(harness.calls[0][2].tasks[0].recurrenceFrequency, null);
  assert.equal(harness.calls[0][2].tasks[1].recurrenceFrequency, null);
  assert.equal(harness.calls[0][2].tasks[1].recurrenceEndsOn, null);
});

import assert from "node:assert/strict";
import test from "node:test";

import { normalizePermissions } from "./permissions.ts";
import { apiError, apiJson } from "./apiResponse.ts";
import { createTaskApplication } from "./taskHandlerFactory.ts";
import { normalizeLegacyEvaluationInput } from "./legacyEvaluationValidation.ts";
import { canTaskAction } from "./authorization.ts";
import { taskBasePermission, canTaskBase } from "./taskAuthorization.ts";

const uuid = (n) => `00000000-0000-4000-8000-0000000000${n}`;
const actor = {
  id: uuid("10"), full_name: "Actor", email: null, username: null,
  department_id: uuid("11"), department_code: "ops", role_code: "nhan_vien",
  role_name: "Staff", role_level: 1, active: true,
  permissions: normalizePermissions({}), rbacPermissions: ["task.quick_report.create"],
};
const validRow = (overrides = {}) => ({
  title: "Sửa máy in", category: "printer_device", startDate: "2026-10-01",
  completionDate: "2026-10-01", status: "done", notes: "Xong", ...overrides,
});

const harness = (actorOverride = {}, status = "done") => {
  const calls = [];
  const uploads = [];
  const repository = {
    createQuickReportBatch: (...args) => { calls.push(args); return Promise.resolve({ ok: true, data: { batchId: uuid("20"), tasks: args[1].rows.map((row, index) => ({ ordinal: index + 1, id: uuid(String(50 + index)), title: row.title })), count: args[1].rows.length, replayed: false } }); },
    access: async id => ({ ok: true, data: { id, createdBy: actor.id, ownerId: actor.id, assigneeId: actor.id, participants: [], departmentId: actor.department_id, taskType: "personal", workflowType: "REPORT_ONLY", status } }),
    addAttachmentMetadata: async (...args) => { uploads.push(args); return { ok: true, data: { id: uuid("60"), file_name: args[2].fileName } }; },
  };
  const app = createTaskApplication({
    repository,
    readActor: async () => ({ ok: true, actor: { ...actor, ...actorOverride } }),
    mutationActor: async () => ({ ok: true, actor: { ...actor, ...actorOverride } }),
    json: apiJson, error: apiError,
    rpcFailure: () => apiError("operation_failed", 500),
    asUuid: (value) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null,
    canAssignToDepartment: () => false, resolveAssignmentParticipants: async () => ({ ok: false }),
    canTaskAction, taskRbacEnabled: true,
    taskRbacBaseAllowed: async (user, action, task) => canTaskBase({ id: user.id, departmentId: user.department_id, roleCode: user.role_code, grants: [{ permissionCode: "task.view", scope: "self" }] }, taskBasePermission(action), task),
    normalizeLegacyEvaluationInput, newUuid: () => uuid("30"),
    uploadPrivateAttachment: async () => ({ ok: true }), removePrivateAttachment: async () => {}, signPrivateAttachment: async () => ({ ok: true, url: "" }),
  });
  return { app, calls, uploads };
};

test("quick report single request uses actor-owned request id and row", async () => {
  const h = harness();
  const response = await h.app.quickReport(new Request("https://example.test/api/tasks/quick-report", {
    method: "POST", body: JSON.stringify({ requestId: uuid("40"), rows: [validRow()] }),
  }));
  assert.equal(response.status, 201);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0][0], actor.id);
  assert.equal(h.calls[0][1].requestId, uuid("40"));
  assert.equal(h.calls[0][1].rows[0].status, "done");
  assert.deepEqual((await response.json()).tasks, [{ ordinal: 1, id: uuid("50"), title: "Sửa máy in" }]);
});

for (const status of ["in_progress", "done", "pending_review"]) {
  test(`quick-report creator can upload through the handler in ${status}`, async () => {
    const h = harness({}, status);
    const form = new FormData();
    form.set("file", new File(["evidence"], "proof.pdf", { type: "application/pdf" }));
    const response = await h.app.uploadAttachment(new Request("https://example.test/api/tasks/attachments", { method: "POST", body: form }), uuid("50"));
    assert.equal(response.status, 201);
    assert.equal(h.uploads.length, 1);
    assert.equal(h.uploads[0][0], actor.id);
    assert.equal(h.uploads[0][1], uuid("50"));
  });
}

test("unrelated user cannot upload to the quick report", async () => {
  const h = harness({ id: uuid("99") });
  const form = new FormData(); form.set("file", new File(["evidence"], "proof.pdf"));
  const response = await h.app.uploadAttachment(new Request("https://example.test", { method: "POST", body: form }), uuid("50"));
  assert.equal(response.status, 403);
  assert.equal(h.uploads.length, 0);
});

test("quick report preserves a completion date different from the start date", async () => {
  const h = harness();
  const response = await h.app.quickReport(new Request("https://example.test/api/tasks/quick-report", {
    method: "POST", body: JSON.stringify({ requestId: uuid("43"), rows: [validRow({ startDate: "2026-10-07", completionDate: "2026-10-09" })] }),
  }));
  assert.equal(response.status, 201);
  assert.equal(h.calls[0][1].rows[0].completionDate, "2026-10-09");
});

test("quick report rejects unauthorized actor before repository mutation", async () => {
  const h = harness({ rbacPermissions: [] });
  const response = await h.app.quickReport(new Request("https://example.test/api/tasks/quick-report", {
    method: "POST", body: JSON.stringify({ requestId: uuid("41"), rows: [validRow()] }),
  }));
  assert.equal(response.status, 403);
  assert.equal(h.calls.length, 0);
});

test("quick report returns friendly date-order validation", async () => {
  const h = harness();
  const response = await h.app.quickReport(new Request("https://example.test/api/tasks/quick-report", {
    method: "POST", body: JSON.stringify({ requestId: uuid("42"), rows: [validRow({ startDate: "2026-10-07", completionDate: "2026-10-06" })] }),
  }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.message, "Ng\u00e0y ho\u00e0n th\u00e0nh kh\u00f4ng \u0111\u01b0\u1ee3c tr\u01b0\u1edbc ng\u00e0y b\u1eaft \u0111\u1ea7u.");
  assert.equal(h.calls.length, 0);
});

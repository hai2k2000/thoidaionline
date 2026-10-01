import assert from "node:assert/strict";
import test from "node:test";

import { normalizePermissions } from "./permissions.ts";
import { apiError, apiJson } from "./apiResponse.ts";
import { createTaskApplication } from "./taskHandlerFactory.ts";
import { normalizeLegacyEvaluationInput } from "./legacyEvaluationValidation.ts";

const uuid = (n) => `00000000-0000-4000-8000-0000000000${n}`;
const actor = {
  id: uuid("10"), full_name: "Actor", email: null, username: null,
  department_id: uuid("11"), department_code: "ops", role_code: "nhan_vien",
  role_name: "Staff", role_level: 1, active: true,
  permissions: normalizePermissions({}), rbacPermissions: ["task.quick_report.create"],
};
const validRow = (overrides = {}) => ({
  title: "Sửa máy in", category: "printer_device", workDate: "2026-10-01",
  startedTime: "09:15", completedTime: "09:30", status: "done", notes: "Xong", ...overrides,
});

const harness = (actorOverride = {}) => {
  const calls = [];
  const repository = { createQuickReportBatch: (...args) => { calls.push(args); return Promise.resolve({ ok: true, data: { batchId: uuid("20"), tasks: [], count: args[1].rows.length, replayed: false } }); } };
  const app = createTaskApplication({
    repository,
    readActor: async () => ({ ok: true, actor: { ...actor, ...actorOverride } }),
    mutationActor: async () => ({ ok: true, actor: { ...actor, ...actorOverride } }),
    json: apiJson, error: apiError,
    rpcFailure: () => apiError("operation_failed", 500),
    asUuid: (value) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null,
    canAssignToDepartment: () => false, resolveAssignmentParticipants: async () => ({ ok: false }),
    canTaskAction: () => false, taskRbacEnabled: false,
    normalizeLegacyEvaluationInput, newUuid: () => uuid("30"),
    uploadPrivateAttachment: async () => ({ ok: true }), removePrivateAttachment: async () => {}, signPrivateAttachment: async () => ({ ok: true, url: "" }),
  });
  return { app, calls };
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
});

test("quick report rejects unauthorized actor before repository mutation", async () => {
  const h = harness({ rbacPermissions: [] });
  const response = await h.app.quickReport(new Request("https://example.test/api/tasks/quick-report", {
    method: "POST", body: JSON.stringify({ requestId: uuid("41"), rows: [validRow()] }),
  }));
  assert.equal(response.status, 403);
  assert.equal(h.calls.length, 0);
});

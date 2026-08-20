import assert from "node:assert/strict";
import test from "node:test";
import { createTaskApplication } from "./taskHandlerFactory.ts";

const taskId = "11111111-1111-4111-8111-111111111111";
const actor = {
  id: "22222222-2222-4222-8222-222222222222",
  department_id: "33333333-3333-4333-8333-333333333333",
  role_code: "admin",
  role_level: 1,
  permissions: {},
};
const access = {
  id: taskId, departmentId: actor.department_id, createdBy: actor.id,
  ownerId: null, assigneeId: null, reviewerId: null, departmentManagerId: null,
  selfClaimable: false, taskType: "assigned", status: "new", participants: [],
};

const application = ({ metadataOk = true } = {}) => {
  const calls = { uploads: [], removals: [], metadata: [] };
  const app = createTaskApplication({
    repository: {
      access: async () => ({ ok: true, data: access }),
      addAttachmentMetadata: async (_actorId, _taskId, input) => {
        calls.metadata.push(input);
        return metadataOk ? { ok: true, data: { id: "attachment" } } : { ok: false, error: { code: "metadata_failed" } };
      },
    },
    readActor: async () => ({ ok: true, actor }),
    mutationActor: async () => ({ ok: true, actor }),
    json: (body, status = 200) => Response.json(body, { status }),
    error: (code, status) => Response.json({ code }, { status }),
    rpcFailure: (error) => Response.json(error, { status: 409 }),
    asUuid: (value) => typeof value === "string" ? value : null,
    canAssignToDepartment: () => true,
    resolveAssignmentParticipants: async () => ({ ok: false }),
    canTaskAction: () => true,
    normalizeLegacyEvaluationInput: () => ({}),
    newUuid: () => "44444444-4444-4444-8444-444444444444",
    uploadPrivateAttachment: async (path, data, mimeType) => {
      calls.uploads.push({ path, bytes: data.byteLength, mimeType });
      return { ok: true };
    },
    removePrivateAttachment: async (path) => { calls.removals.push(path); },
    signPrivateAttachment: async () => ({ ok: false, error: {} }),
  });
  return { app, calls };
};

const unicodeDocxRequest = () => {
  const form = new FormData();
  form.set("file", new File([new Uint8Array([1, 2, 3])], "BT-LC-Trả-lời-phỏng-vấn.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }));
  return new Request("https://example.test/api/tasks/x/attachments", { method: "POST", body: form });
};

test("Unicode DOCX keeps its display name but uses an ASCII-only storage key", async () => {
  const { app, calls } = application();
  const response = await app.uploadAttachment(unicodeDocxRequest(), taskId);
  assert.equal(response.status, 201);
  assert.equal(calls.uploads[0].path, `${taskId}/44444444-4444-4444-8444-444444444444.docx`);
  assert.equal(calls.metadata[0].fileName, "BT-LC-Trả-lời-phỏng-vấn.docx");
  assert.equal(calls.uploads[0].mimeType, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
});

test("metadata failure removes the uploaded object", async () => {
  const { app, calls } = application({ metadataOk: false });
  const response = await app.uploadAttachment(unicodeDocxRequest(), taskId);
  assert.equal(response.status, 409);
  assert.deepEqual(calls.removals, [`${taskId}/44444444-4444-4444-8444-444444444444.docx`]);
});

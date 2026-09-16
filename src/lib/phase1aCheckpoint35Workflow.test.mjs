import assert from "node:assert/strict";
import test from "node:test";

import { canAssignToDepartment, canTaskAction } from "./authorization.ts";
import { normalizePermissions } from "./permissions.ts";
import { canTaskBase, decideTaskAuthorization, taskBasePermission } from "./taskAuthorization.ts";
import { createTaskApplication } from "./taskHandlerFactory.ts";

const rolePermissions = {
  admin: { can_assign_task: true, can_view_department_tasks: true, can_comment: true, can_create_task: true, can_edit_all_tasks: true, can_evaluate_step1: true, can_evaluate_step2: true },
  tong_bien_tap: { can_assign_task: true, can_view_department_tasks: true, can_comment: true, can_create_task: true, can_evaluate_step2: true },
  truong_phong: { can_assign_task: true, can_view_department_tasks: true, can_comment: true, can_create_task: true, can_evaluate_step1: true },
  phong_vien: { can_comment: true, can_create_task: true, can_evaluate_step1: true },
  nhan_vien: { can_comment: true, can_create_task: true },
  tbt_read_only: {},
};

const grantScopes = {
  admin: { "task.view": ["all"], "task.create": ["all"], "task.evaluate.step1": ["all"] },
  tong_bien_tap: { "task.view": ["all"], "task.evaluate.step2": ["all"] },
  truong_phong: { "task.view": ["assigned", "department"] },
  phong_vien: { "task.view": ["self", "assigned"] },
  nhan_vien: { "task.view": ["self", "assigned"] },
  tbt_read_only: { "task.view": ["all"] },
};

const states = ["new", "in_progress", "pending_review", "rejected", "done", "cancelled"];
const actions = [
  ["submit", "report"], ["return", "review"], ["resubmit", "report"],
  ["approve", "review"], ["score", "review"], ["rescore", "review"],
  ["update", "update"], ["deadline change", "update"], ["cancel", "assigned_cancel"],
  ["reopen", "update"], ["attachment", "attachment"],
];

const fixture = (roleCode, relation, state) => {
  const actorId = "actor";
  const task = {
    id: `${roleCode}-${relation}-${state}`,
    departmentId: relation === "other_department" ? "dep-b" : "dep-a",
    createdBy: relation === "creator" || relation === "owner" ? actorId : "creator",
    ownerId: relation === "owner" ? actorId : "owner",
    assigneeId: relation === "assignee" ? actorId : "assignee",
    reviewerId: relation === "reviewer" ? actorId : "reviewer",
    departmentManagerId: relation === "manager" ? actorId : null,
    selfClaimable: false,
    taskType: "assigned",
    status: state,
    participants: relation === "participant" ? [{ userId: actorId, assignmentRole: "owner" }] : [],
  };
  const actor = {
    id: actorId,
    departmentId: "dep-a",
    roleCode,
    roleLevel: 1,
    permissions: normalizePermissions(rolePermissions[roleCode]),
  };
  const grants = Object.entries(grantScopes[roleCode]).flatMap(([permissionCode, scopes]) =>
    scopes.map((scope) => ({ permissionCode, scope })));
  const rbac = {
    id: actorId,
    departmentId: "dep-a",
    grants,
  };
  return { actor, task, rbac };
};

const classify = (legacy, base, final) => ({
  legacy,
  base,
  workflow: legacy,
  final,
  classification: !legacy && final ? "SECURITY_CRITICAL_MISMATCH"
    : legacy && !final ? "RESTRICTIVE_MISMATCH"
      : legacy ? "MATCH_ALLOW" : "MATCH_DENY",
});

test("workflow characterization records all four authorization layers across states and relations", () => {
  const relations = ["creator", "owner", "assignee", "reviewer", "participant", "manager", "other_department"];
  const rows = [];
  for (const roleCode of Object.keys(grantScopes)) {
    for (const relation of relations) {
      for (const state of states) {
        const { actor, task, rbac } = fixture(roleCode, relation, state);
        for (const [label, legacyAction] of actions) {
          const legacy = canTaskAction(actor, task, legacyAction);
          const base = canTaskBase(rbac, taskBasePermission(label, roleCode), {
            kind: "task", id: task.id, departmentId: task.departmentId,
            createdBy: task.createdBy, ownerId: task.ownerId, assigneeId: task.assigneeId,
            reviewerId: task.reviewerId, participantIds: task.participants.map((item) => item.userId),
          });
          const final = decideTaskAuthorization({ enabled: true, legacyAllowed: legacy, rbacBaseAllowed: base }).finalAllowed;
          rows.push({ roleCode, relation, state, action: label, ...classify(legacy, base, final) });
        }
      }
    }
  }
  const critical = rows.filter((row) => row.classification === "SECURITY_CRITICAL_MISMATCH");
  const restrictive = rows.filter((row) => row.classification === "RESTRICTIVE_MISMATCH");
  console.log(`checkpoint3.5-workflow rows=${rows.length} match_allow=${rows.filter((row) => row.classification === "MATCH_ALLOW").length} match_deny=${rows.filter((row) => row.classification === "MATCH_DENY").length} restrictive=${restrictive.length} critical=${critical.length}`);
  assert.equal(critical.length, 0, JSON.stringify(critical, null, 2));
  assert.equal(restrictive.length, 0, JSON.stringify(restrictive, null, 2));
});

test("task.view base is sufficient for every legacy-allowed workflow case without mutation inference", () => {
  const legacyAllowed = [];
  for (const roleCode of Object.keys(grantScopes)) {
    for (const relation of ["creator", "owner", "assignee", "reviewer", "participant", "manager"]) {
      const { actor, task, rbac } = fixture(roleCode, relation, "in_progress");
      for (const [label, legacyAction] of actions) {
        if (!canTaskAction(actor, task, legacyAction)) continue;
        const base = canTaskBase(rbac, "task.view", {
          kind: "task", id: task.id, departmentId: task.departmentId,
          createdBy: task.createdBy, ownerId: task.ownerId, assigneeId: task.assigneeId,
          reviewerId: task.reviewerId, participantIds: task.participants.map((item) => item.userId),
        });
        legacyAllowed.push({ roleCode, relation, action: label, base });
      }
    }
  }
  const missing = legacyAllowed.filter((row) => !row.base);
  assert.equal(missing.length, 0, JSON.stringify(missing, null, 2));
});

test("evaluation step1 and step2 retain legacy evaluator/stage guards", () => {
  const step1 = fixture("admin", "creator", "pending_review");
  const step2 = fixture("tong_bien_tap", "reviewer", "pending_review");
  for (const [fixtureValue, action, role] of [[step1, "evaluate", "truong_phong"], [step2, "leader_evaluate", "tong_bien_tap"]]) {
    const legacy = canTaskAction(fixtureValue.actor, fixtureValue.task, action);
    const base = canTaskBase(fixtureValue.rbac, taskBasePermission(action, role), {
      kind: "task", id: fixtureValue.task.id, departmentId: fixtureValue.task.departmentId,
      createdBy: fixtureValue.task.createdBy, ownerId: fixtureValue.task.ownerId,
      assigneeId: fixtureValue.task.assigneeId, reviewerId: fixtureValue.task.reviewerId,
      participantIds: [],
    });
    assert.equal(decideTaskAuthorization({ enabled: true, legacyAllowed: legacy, rbacBaseAllowed: base }).finalAllowed, legacy && base);
  }
});

test("flag-on assigned workflow completes assign -> submit -> return -> resubmit -> score -> approve", async () => {
  const manager = {
    id: "manager", full_name: "Manager", email: null, phone: null, username: null,
    department_id: "dep-a", role_code: "truong_phong", role_name: "Manager", role_level: 2,
    active: true, session_version: 1, must_change_password: false, is_department_manager: true,
    permissions: normalizePermissions({ can_assign_task: true, can_view_department_tasks: true, can_comment: true, can_evaluate_step1: true }),
    avatar_url: null, preferences: {},
  };
  const employee = { ...manager, id: "employee", role_code: "phong_vien", role_name: "Staff", role_level: 1,
    permissions: normalizePermissions({ can_comment: true }) };
  const taskState = {
    id: "00000000-0000-4000-8000-000000000035", departmentId: "dep-a", createdBy: "manager",
    ownerId: "manager", assigneeId: "employee", reviewerId: "manager", departmentManagerId: "manager",
    selfClaimable: false, taskType: "assigned", status: "new", participants: [],
  };
  const repository = {
    access: async () => ({ ok: true, data: { ...taskState, participants: [...taskState.participants] } }),
    assign: async () => ({ ok: true, data: { id: taskState.id } }),
    report: async () => { taskState.status = "in_progress"; return { ok: true, data: {} }; },
    submitAssignedCompletion: async () => { taskState.status = "pending_review"; return { ok: true, data: {} }; },
    reviewAssignedCompletion: async (_id, _task, decision) => { taskState.status = decision === "return" ? "rejected" : "done"; return { ok: true, data: {} }; },
    scoreTaskCompletion: async () => ({ ok: true, data: {} }),
  };
  const actorApp = (actor) => createTaskApplication({
    repository,
    readActor: async () => ({ ok: true, actor }),
    mutationActor: async () => ({ ok: true, actor }),
    json: (body, status = 200) => Response.json(body, { status }),
    error: (_code, status) => Response.json({}, { status }),
    rpcFailure: () => Response.json({}, { status: 500 }),
    asUuid: (value) => typeof value === "string" ? value : null,
    canAssignToDepartment,
    resolveAssignmentParticipants: async (_actor, input) => ({ ok: true, collaboratorIds: input.collaboratorIds, watcherIds: input.watcherIds }),
    canTaskAction,
    taskRbacEnabled: true,
    taskRbacBaseAllowed: async (user, action, task) => canTaskBase({ id: user.id, departmentId: user.department_id, grants: [
      { permissionCode: "task.view", scope: "all" }, { permissionCode: "task.assign", scope: "department" },
    ] }, taskBasePermission(action, user.role_code), task && {
      kind: "task", id: task.id, departmentId: task.departmentId, createdBy: task.createdBy,
      ownerId: task.ownerId, assigneeId: task.assigneeId, reviewerId: task.reviewerId,
      participantIds: task.participants.map((item) => item.userId),
    }),
    normalizeLegacyEvaluationInput: () => ({}), newUuid: () => "00000000-0000-4000-8000-000000000036",
    uploadPrivateAttachment: async () => ({ ok: true }), removePrivateAttachment: async () => {}, signPrivateAttachment: async () => ({ ok: true, url: "" }),
  });
  const assignResponse = await actorApp(manager).assign(new Request("https://example.test/api/tasks/assign", { method: "POST", body: JSON.stringify({
    title: "Task", requirements: ["Requirement"], departmentId: "dep-a", assigneeId: "00000000-0000-0000-0000-000000000002", dueDate: "2026-09-30", dueTime: "17:30", collaboratorIds: [], watcherIds: [], recurrenceFrequency: null, recurrenceEndsOn: null,
  }) }));
  assert.equal(assignResponse.status, 201);
  const employeeApp = actorApp(employee);
  assert.equal((await employeeApp.report(new Request("https://example.test/api/tasks/report", { method: "POST", body: JSON.stringify({ taskId: taskState.id, progress: 50, report: "started" }) }))).status, 200);
  assert.equal((await employeeApp.submitAssignedCompletion(new Request("https://example.test/api/tasks/complete"), taskState.id)).status, 200);
  assert.equal((await actorApp(manager).reviewAssignedCompletion(new Request("https://example.test/api/tasks/review", { method: "POST", body: JSON.stringify({ decision: "return", reason: "Need more detail" }) }), taskState.id)).status, 200);
  assert.equal((await employeeApp.report(new Request("https://example.test/api/tasks/report", { method: "POST", body: JSON.stringify({ taskId: taskState.id, progress: 90, report: "resubmitted" }) }))).status, 200);
  assert.equal((await employeeApp.submitAssignedCompletion(new Request("https://example.test/api/tasks/complete"), taskState.id)).status, 200);
  assert.equal((await actorApp(manager).reviewAssignedCompletion(new Request("https://example.test/api/tasks/review", { method: "POST", body: JSON.stringify({ requirementResults: [{ achieved: true }], requirementScore: 50, collaborationScore: 10, initiativeScore: 10 }) }), taskState.id)).status, 200);
  assert.equal((await actorApp(manager).reviewAssignedCompletion(new Request("https://example.test/api/tasks/review", { method: "POST", body: JSON.stringify({ decision: "approve" }) }), taskState.id)).status, 200);
  assert.equal(taskState.status, "done");
});

test("flag-on direct API deny scenarios remain denied with task.view base", async () => {
  const task = {
    id: "00000000-0000-0000-0000-000000000035", departmentId: "dep-a", createdBy: "creator",
    ownerId: "owner", assigneeId: "assignee", reviewerId: "reviewer", departmentManagerId: "manager",
    selfClaimable: false, taskType: "assigned", status: "pending_review", participants: [],
  };
  const actor = (id, roleCode, department_id = "dep-a", permissions = {}) => ({
    id, full_name: id, email: null, phone: null, username: null, department_id, role_code: roleCode,
    role_name: roleCode, role_level: 1, active: true, session_version: 1, must_change_password: false,
    is_department_manager: roleCode === "truong_phong", permissions: normalizePermissions(permissions), avatar_url: null, preferences: {},
  });
  const appFor = (user) => createTaskApplication({
    repository: { access: async () => ({ ok: true, data: task }), report: async () => ({ ok: true, data: {} }), review: async () => ({ ok: true, data: {} }),
      scoreTaskCompletion: async () => ({ ok: true, data: {} }), submitQualitativeEvaluation: async () => ({ ok: true, data: {} }) },
    readActor: async () => ({ ok: true, actor: user }), mutationActor: async () => ({ ok: true, actor: user }),
    json: (body, status = 200) => Response.json(body, { status }), error: (_code, status) => Response.json({}, { status }),
    rpcFailure: () => Response.json({}, { status: 500 }), asUuid: (value) => typeof value === "string" ? value : null,
    canAssignToDepartment, resolveAssignmentParticipants: async () => ({ ok: false }), canTaskAction,
    taskRbacEnabled: true, taskRbacBaseAllowed: async (_actor, action, resource) => canTaskBase(
      { id: user.id, departmentId: user.department_id, grants: [{ permissionCode: taskBasePermission(action, user.role_code), scope: "all" }] },
      taskBasePermission(action, user.role_code), resource && { kind: "task", ...resource, participantIds: resource.participants.map((item) => item.userId) }),
    normalizeLegacyEvaluationInput: () => ({}), newUuid: () => "00000000-0000-0000-0000-000000000036",
    uploadPrivateAttachment: async () => ({ ok: true }), removePrivateAttachment: async () => {}, signPrivateAttachment: async () => ({ ok: true, url: "" }),
  });
  const deny = async (responsePromise) => assert.equal((await responsePromise).status, 403);
  await deny(appFor(actor("outsider", "nhan_vien", "dep-b")).report(new Request("https://example.test/api/tasks/report", { method: "POST", body: JSON.stringify({ taskId: task.id, progress: 10, report: "x" }) })));
  await deny(appFor(actor("employee", "nhan_vien")).review(new Request("https://example.test/api/tasks/review", { method: "POST", body: JSON.stringify({ taskId: task.id, decision: "approve" }) })));
  await deny(appFor(actor("employee", "nhan_vien")).review(new Request("https://example.test/api/tasks/review", { method: "POST", body: JSON.stringify({ taskId: task.id, decision: "reject", note: "x" }) })));
  await deny(appFor(actor("manager-b", "truong_phong", "dep-b", { can_view_department_tasks: true })).review(new Request("https://example.test/api/tasks/review", { method: "POST", body: JSON.stringify({ taskId: task.id, decision: "reject", note: "x" }) })));
  await deny(appFor(actor("wrong-evaluator", "phong_vien", "dep-a", { can_evaluate_step1: true })).submitQualitativeEvaluation(new Request("https://example.test/api/tasks/evaluations", { method: "POST", body: JSON.stringify({ evaluationText: "x" }) }), task.id));
  await deny(appFor(actor("readonly", "tbt_read_only")).report(new Request("https://example.test/api/tasks/report", { method: "POST", body: JSON.stringify({ taskId: task.id, progress: 10, report: "x" }) })));
});

test("attachment keeps legacy resource guard under flag ON", async () => {
  const task = {
    id: "00000000-0000-0000-0000-000000000035", departmentId: "dep-a", createdBy: "owner",
    ownerId: "owner", assigneeId: "assignee", reviewerId: "reviewer", departmentManagerId: null,
    selfClaimable: false, taskType: "assigned", status: "in_progress", participants: [],
  };
  const actor = (id) => ({ id, full_name: id, email: null, phone: null, username: null, department_id: "dep-a", role_code: "phong_vien", role_name: "Staff", role_level: 1, active: true, session_version: 1, must_change_password: false, is_department_manager: false, permissions: normalizePermissions({}), avatar_url: null, preferences: {} });
  const makeApp = (user) => createTaskApplication({
    repository: { access: async () => ({ ok: true, data: task }), addAttachmentMetadata: async () => ({ ok: true, data: { id: "attachment" } }), attachment: async () => ({ ok: true, data: { storage_path: "private/file.pdf" } }) },
    readActor: async () => ({ ok: true, actor: user }), mutationActor: async () => ({ ok: true, actor: user }),
    json: (body, status = 200) => Response.json(body, { status }), error: (_code, status) => Response.json({}, { status }), rpcFailure: () => Response.json({}, { status: 500 }),
    asUuid: (value) => typeof value === "string" ? value : null, canAssignToDepartment, resolveAssignmentParticipants: async () => ({ ok: false }), canTaskAction,
    taskRbacEnabled: true, taskRbacBaseAllowed: async (_actor, action, resource) => canTaskBase({ id: user.id, departmentId: user.department_id, grants: [{ permissionCode: taskBasePermission(action, user.role_code), scope: "all" }] }, taskBasePermission(action, user.role_code), resource && { kind: "task", ...resource, participantIds: resource.participants.map((item) => item.userId) }),
    normalizeLegacyEvaluationInput: () => ({}), newUuid: () => "00000000-0000-0000-0000-000000000036", uploadPrivateAttachment: async () => ({ ok: true }), removePrivateAttachment: async () => {}, signPrivateAttachment: async () => ({ ok: true, url: "signed" }),
  });
  const form = new FormData();
  form.set("file", new File([new Uint8Array([1])], "proof.pdf", { type: "application/pdf" }));
  assert.equal((await makeApp(actor("owner")).uploadAttachment(new Request("https://example.test/api/tasks/x/attachments", { method: "POST", body: form }), task.id)).status, 201);
  assert.equal((await makeApp(actor("outsider")).downloadAttachment(task.id, "00000000-0000-0000-0000-000000000037")).status, 403);
});

import { canAssignToDepartment, canTaskAction } from "./authorization.ts";
import { normalizePermissions } from "./permissions.ts";
import { createTaskApplication } from "./taskHandlerFactory.ts";
import { can } from "./rbac/authorization.ts";
import { taskBasePermission } from "./taskAuthorization.ts";
import { resolveAttendanceAccessFromScopes } from "./attendanceAccessCore.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { buildEvaluationRows, canViewAttendanceRate, completionTotal } from "./publicEvaluationSummary.ts";
test("completionTotal handles object arrays and null",()=>{assert.equal(completionTotal({total_score:70.1}),70.1);assert.equal(completionTotal([{total_score:80.2}]),80.2);assert.equal(completionTotal(null),null);assert.equal(completionTotal({total_score:null}),null);});
test("evaluation rows keep aggregate totals while hiding task details",()=>{const rows=buildEvaluationRows({people:[{id:"p",full_name:"P",department_id:"a",department_name:"A"}],tasks:[{id:"visible",title:"Visible",status:"done",due_date:null,assignee_id:"p",completion_score:{total_score:70.1}},{id:"hidden",title:"Secret",status:"in_progress",due_date:"2020-01-01",assignee_id:"p",completion_score:[{total_score:80.2}]}],attendance:[],attendanceAvailable:false,viewableTaskIds:new Set(["visible"]),viewer:{id:"viewer",departmentId:null,orgScope:null},today:"2026-11-07"});assert.equal(rows[0].total,2);assert.equal(rows[0].score,150.3);assert.equal(rows[0].hiddenTaskCount,1);assert.deepEqual(rows[0].tasks.map((task)=>task.id),["visible"]);assert.equal(JSON.stringify(rows[0]).includes("Secret"),false);});
test("attendance scope rules",()=>{assert.equal(canViewAttendanceRate({id:"v",departmentId:"a",orgScope:null},{id:"v",departmentId:"b"}),true);assert.equal(canViewAttendanceRate({id:"v",departmentId:"a",orgScope:"department"},{id:"s",departmentId:"a"}),true);assert.equal(canViewAttendanceRate({id:"v",departmentId:"a",orgScope:"department"},{id:"s",departmentId:"b"}),false);assert.equal(canViewAttendanceRate({id:"v",departmentId:null,orgScope:"department"},{id:"s",departmentId:null}),false);});
const rolePermissions = {
  nhan_vien: { can_comment: true, can_create_task: true },
  truong_phong: { can_assign_task: true, can_view_department_tasks: true, can_comment: true, can_create_task: true, can_evaluate_step1: true },
  tong_bien_tap: { can_assign_task: true, can_view_department_tasks: true, can_comment: true, can_create_task: true, can_evaluate_step2: true },
  admin: { can_assign_task: true, can_view_department_tasks: true, can_comment: true, can_create_task: true, can_edit_all_tasks: true, can_evaluate_step1: true, can_evaluate_step2: true },
};
const grantScopes = { nhan_vien: ["self", "assigned"], truong_phong: ["assigned", "department"], tong_bien_tap: ["all"], admin: ["all"] };
const actors = Object.fromEntries(Object.keys(rolePermissions).map((role) => [role, {
  id: role === "nhan_vien" ? "nv" : role === "truong_phong" ? "tp" : role,
  department_id: role === "admin" || role === "tong_bien_tap" ? null : "dep-a",
  role_code: role, role_level: role === "nhan_vien" ? 1 : 2,
  permissions: normalizePermissions(rolePermissions[role]),
}]));
const tasks = [
  { id: "own", assigneeId: "nv", departmentId: "dep-a" },
  { id: "coworker", assigneeId: "nvKhac", departmentId: "dep-a" },
  { id: "reviewed", assigneeId: "nvKhac", reviewerId: "nv", departmentId: "dep-a" },
  { id: "otherDept", assigneeId: "personB", departmentId: "dep-b" },
].map((task) => ({ createdBy: "creator", ownerId: "owner", reviewerId: null, departmentManagerId: "tp", selfClaimable: false, taskType: "assigned", status: "in_progress", participants: [], ...task }));
const resource = (task) => ({ kind: "task", id: task.id, departmentId: task.departmentId, createdBy: task.createdBy, ownerId: task.ownerId, assigneeId: task.assigneeId, reviewerId: task.reviewerId, participantIds: [] });
const rbacActor = (actor) => ({ id: actor.id, departmentId: actor.department_id, grants: grantScopes[actor.role_code].map((scope) => ({ permissionCode: "task.view", scope })) });
function application(actor, taskRbacEnabled, overrides = {}) {
  const repository = {
    access: async (id) => ({ ok: true, data: tasks.find((task) => task.id === id) ?? null }),
    accessMany: async (ids) => ({ ok: true, data: tasks.filter((task) => ids.includes(task.id)) }),
    detail: async (id) => ({ ok: true, data: { id, legacy_evaluations: [] } }),
    ...overrides,
  };
  return createTaskApplication({ repository,
    readActor: async () => ({ ok: true, actor }), mutationActor: async () => ({ ok: true, actor }),
    json: (body, status = 200) => Response.json(body, { status }),
    error: (_code, status) => Response.json({}, { status }),
    rpcFailure: () => Response.json({}, { status: 500 }),
    asUuid: (value) => typeof value === "string" ? value : null,
    canAssignToDepartment, canTaskAction, taskRbacEnabled,
    taskRbacBaseChecker: Object.hasOwn(overrides, "taskRbacBaseChecker") ? overrides.taskRbacBaseChecker : async (user, action) => (task) => can(rbacActor(user), taskBasePermission(action, user.role_code), resource(task)),
    taskRbacBaseAllowed: async (user, action, task) => can(rbacActor(user), taskBasePermission(action, user.role_code), task ? resource(task) : undefined),
    normalizeLegacyEvaluationInput: () => ({}), newUuid: () => "new",
    uploadPrivateAttachment: async () => ({ ok: true }), removePrivateAttachment: async () => {}, downloadPrivateAttachment: async () => ({ ok: false }),
    resolveAssignmentParticipants: async () => ({ ok: true, collaboratorIds: [], watcherIds: [] }),
  });
}
for (const taskRbacEnabled of [false, true]) {
  for (const [role, expected] of [
    ["nhan_vien", ["own", "reviewed"]],
    ["truong_phong", ["own", "coworker", "reviewed"]],
    ["tong_bien_tap", ["own", "coworker", "reviewed", "otherDept"]],
    ["admin", ["own", "coworker", "reviewed", "otherDept"]],
  ]) {
    test(`viewable tasks for ${role} flag=${taskRbacEnabled}`, async () => {
      const result = await application(actors[role], taskRbacEnabled).viewableTaskIds(actors[role], tasks.map((task) => task.id));
      assert.equal(result.ok, true);
      assert.deepEqual([...result.ids], expected);
    });
  }
  test(`batch visibility matches detail flag=${taskRbacEnabled}`, async () => {
    for (const actor of Object.values(actors)) {
      const app = application(actor, taskRbacEnabled);
      const result = await app.viewableTaskIds(actor, tasks.map((task) => task.id));
      for (const task of tasks) assert.equal(result.ids.has(task.id), (await app.detail(task.id)).status === 200, `${actor.role_code}:${task.id}`);
    }
  });
  test(`accessMany failure flag=${taskRbacEnabled}`, async () => {
    const app = application(actors.nhan_vien, taskRbacEnabled, { accessMany: async () => ({ ok: false, error: { code: "failed" } }) });
    assert.deepEqual(await app.viewableTaskIds(actors.nhan_vien, ["own"]), { ok: false });
  });
  test(`checker failures fail closed flag=${taskRbacEnabled}`, async () => {
    if (!taskRbacEnabled) return;
    const actor = actors.nhan_vien;
    const missing = application(actor, true, { taskRbacBaseChecker: undefined });
    assert.deepEqual(await missing.viewableTaskIds(actor, ["own"]), { ok: true, ids: new Set() });
    const throwing = application(actor, true, { taskRbacBaseChecker: async () => { throw new Error("checker"); } });
    assert.deepEqual(await throwing.viewableTaskIds(actor, ["own"]), { ok: true, ids: new Set() });
    const returnedThrowing = application(actor, true, { taskRbacBaseChecker: async () => () => { throw new Error("predicate"); } });
    assert.deepEqual(await returnedThrowing.viewableTaskIds(actor, ["own"]), { ok: true, ids: new Set() });
  });

}

test("attendance scopes resolve personal access", () => {
  assert.equal(resolveAttendanceAccessFromScopes({ "attendance.view_all": [], "attendance.manage": [] }).orgScope, null);
});
test("attendance scopes resolve department access", () => {
  assert.equal(resolveAttendanceAccessFromScopes({ "attendance.view_all": ["department"], "attendance.manage": [] }).orgScope, "department");
});
test("attendance scopes resolve organization access", () => {
  assert.equal(resolveAttendanceAccessFromScopes({ "attendance.view_all": ["all"], "attendance.manage": [] }).orgScope, "all");
});

test("attendanceRate follows viewer role scopes", () => {
  const people = [
    { id: "nv", full_name: "NV", department_id: "dep-a", department_name: "A" },
    { id: "nv2", full_name: "NV2", department_id: "dep-a", department_name: "A" },
    { id: "pb", full_name: "PB", department_id: "dep-b", department_name: "B" },
  ];
  const attendance = people.map((person) => ({ user_id: person.id, status: "present" }));
  const rows = (viewer) => buildEvaluationRows({ people, tasks: [], attendance, attendanceAvailable: true, viewableTaskIds: new Set(), viewer, today: "2026-11-07" });
  assert.deepEqual(rows({ id: "nv", departmentId: "dep-a", orgScope: null }).map((row) => row.attendanceRate), [100, null, null]);
  assert.deepEqual(rows({ id: "tp", departmentId: "dep-a", orgScope: "department" }).map((row) => row.attendanceRate), [100, 100, null]);
  assert.deepEqual(rows({ id: "tbt", departmentId: null, orgScope: null }).map((row) => row.attendanceRate), [null, null, null]);
  assert.deepEqual(rows({ id: "tbt", departmentId: null, orgScope: "all" }).map((row) => row.attendanceRate), [100, 100, 100]);
  assert.deepEqual(rows({ id: "adm", departmentId: null, orgScope: "all" }).map((row) => row.attendanceRate), [100, 100, 100]);
});

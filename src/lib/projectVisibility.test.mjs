import assert from "node:assert/strict";
import test from "node:test";
import { canTaskAction } from "./authorization.ts";
import { normalizePermissions } from "./permissions.ts";
import { canTaskBase, buildTaskListScope } from "./taskAuthorization.ts";
import { can } from "./rbac/authorization.ts";

const actor = { id: "ctv", departmentId: "other", roleCode: "nhan_vien", roleLevel: 1, permissions: normalizePermissions({}) };
const task = { id: "task", departmentId: "host", createdBy: "lead", ownerId: "worker", assigneeId: "worker", reviewerId: "lead", departmentManagerId: "manager", selfClaimable: false, taskType: "assigned", status: "pending_review", participants: [], projectId: "project", projectMembers: [{ userId: "ctv", role: "member" }, { userId: "lead", role: "lead" }] };

test("legacy project membership permits view/comment without department or workflow access", () => {
  for (const action of ["view", "comment"]) assert.equal(canTaskAction(actor, task, action), true, action);
  for (const action of ["report", "complete_assigned", "review", "update", "attachment"]) assert.equal(canTaskAction(actor, task, action), false, action);
  assert.equal(canTaskAction(actor, { ...task, projectId: null }, "view"), false);
  assert.equal(canTaskAction(actor, { ...task, projectMembers: [] }, "view"), false);
});

test("project leads and admin review project tasks", () => {
  assert.equal(canTaskAction({ ...actor, id: "lead" }, task, "review"), true);
  assert.equal(canTaskAction({ ...actor, roleCode: "admin" }, task, "review"), true);
  assert.equal(canTaskAction({ ...actor, id: "lead" }, { ...task, projectId: null, projectMembers: [] }, "review"), false);
});

test("v2 project membership reaches both base gates without granting unrelated permissions", () => {
  const rbacActor = { id: "ctv", departmentId: "other", grants: [] };
  const resource = { ...task, kind: "task", projectMemberIds: ["ctv", "lead"] };
  for (const gate of [can, canTaskBase]) {
    for (const permission of ["task.view", "task.comment"]) assert.equal(gate(rbacActor, permission, resource), true);
    for (const permission of ["task.assign", "task.edit_all", "task.score"]) assert.equal(gate(rbacActor, permission, resource), false);
    assert.equal(gate(rbacActor, "task.view", { ...resource, projectId: null }), false);
    assert.equal(gate(rbacActor, "task.view", { ...resource, projectMemberIds: [] }), false);
  }
  assert.deepEqual(buildTaskListScope(rbacActor, [], ["project"]), { all: false, terms: ["project_id.in.(project)"] });
  assert.deepEqual(buildTaskListScope(rbacActor, [], []), { all: false, terms: [] });
});


test("admin project override is bounded and reaches both RBAC gates", () => {
  const resource = { ...task, kind: "task", projectMemberIds: [], projectLeadIds: [] };
  for (const gate of [can, canTaskBase]) {
    for (const permission of ["task.view", "task.comment", "task.assign", "task.review", "task.edit_all"]) {
      assert.equal(gate({ id: "admin", roleCode: "admin", departmentId: null, grants: [] }, permission, resource), true);
      assert.equal(gate({ id: "other", roleCode: "tong_bien_tap", departmentId: null, grants: [] }, permission, resource), false);
      assert.equal(gate({ id: "admin", roleCode: "admin", departmentId: null, grants: [] }, permission, {...resource,projectId:null}), false);
    }
  }
  for (const action of ["view", "assign", "review"]) assert.equal(canTaskAction({...actor,id:"admin",roleCode:"admin"},{...task,projectMembers:[]},action),true);
});


test("admin list scope includes all project tasks without widening nonproject scope", () => {
  assert.deepEqual(buildTaskListScope({id:"admin",roleCode:"admin",departmentId:null,grants:[]},[],[]),{all:false,terms:["project_id.not.is.null"]});
});

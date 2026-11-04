import assert from "node:assert/strict";
import test from "node:test";
import { resolveAssignmentSelection } from "./taskAssignmentGroup.ts";
import { canTaskAction } from "./authorization.ts";
import { normalizePermissions } from "./permissions.ts";

test("manager accepts other-department collaborators while rejecting admins and missing users", () => {
  const person = (id, departmentId, roleCode = "phong_vien") => ({ id, departmentId, roleCode, canReview: true, canReviewOutsideDepartment: false });
  const input = { broad: false, actorRoleCode: "truong_phong", actorDepartmentId: "a", department: { id: "a", managerId: "manager" }, people: [person("manager", "a"), person("owner", "a"), person("other", "b"), person("admin", "b", "admin")], departmentId: "a", assigneeId: "owner", reviewerId: "manager", collaboratorIds: ["other"], watcherIds: [], groupDepartmentId: null, excludedMemberIds: [] };
  assert.deepEqual(resolveAssignmentSelection(input), { ok: true, collaboratorIds: ["other"], watcherIds: [] });
  for (const id of ["admin", "missing"]) assert.equal(resolveAssignmentSelection({ ...input, collaboratorIds: [id] }).ok, false);
  for (const patch of [{ assigneeId: "other" }, { reviewerId: "other" }, { watcherIds: ["other"] }, { departmentId: "b" }]) assert.equal(resolveAssignmentSelection({ ...input, ...patch }).ok, false);
});

test("cross-department participant can read, comment, report and attach without owner powers", () => {
  const actor = { id: "other", departmentId: "b", roleCode: "phong_vien", roleLevel: 1, permissions: normalizePermissions({ can_comment: true }) };
  const task = { id: "task", departmentId: "a", createdBy: "manager", ownerId: "owner", assigneeId: "owner", reviewerId: "manager", departmentManagerId: "manager", selfClaimable: false, taskType: "assigned", status: "in_progress", participants: [{ userId: "other", assignmentRole: "assignee" }] };
  for (const action of ["view", "comment", "report", "attachment"]) assert.equal(canTaskAction(actor, task, action), true, action);
  for (const action of ["complete_assigned", "review", "update", "assigned_cancel", "assigned_deadline"]) assert.equal(canTaskAction(actor, task, action), false, action);
});

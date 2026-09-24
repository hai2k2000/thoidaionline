import assert from "node:assert/strict";
import test from "node:test";

const accessModule = await import("./taskPrintAccess.ts").catch(() => ({}));

const actor = {
  id: "viewer",
  departmentId: "department-a",
  departmentCode: "general",
  canAccessJournalism: false,
  roleCode: "nhan_vien",
  roleLevel: 1,
  permissions: { can_view_department_tasks: false },
};
const taskAccess = {
  id: "task",
  departmentId: "department-b",
  createdBy: "creator",
  ownerId: "owner",
  assigneeId: "assignee",
  reviewerId: "reviewer",
  departmentManagerId: null,
  selfClaimable: false,
  taskType: "assigned",
  status: "new",
  participants: [],
};

test("print loader does not fetch task detail when server-side view authorization fails", async () => {
  assert.equal(typeof accessModule.loadPrintableTask, "function");
  let detailCalls = 0;
  const result = await accessModule.loadPrintableTask({
    actor,
    taskId: "task",
    loadAccess: async () => ({ ok: true, data: taskAccess }),
    loadDetail: async () => { detailCalls += 1; return { ok: true, data: { id: "task" } }; },
    canView: () => false,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "forbidden");
  assert.equal(detailCalls, 0);
});

test("print loader passes Journalism scope into the canonical detail repository", async () => {
  assert.equal(typeof accessModule.loadPrintableTask, "function");
  let receivedActor = null;
  const allowedActor = { ...actor, id: "owner", departmentCode: "editorial", canAccessJournalism: true };
  const result = await accessModule.loadPrintableTask({
    actor: allowedActor,
    taskId: "task",
    loadAccess: async () => ({ ok: true, data: { ...taskAccess, ownerId: "owner" } }),
    loadDetail: async (_taskId, repositoryActor) => {
      receivedActor = repositoryActor;
      return { ok: true, data: { id: "task", journalism: { task_id: "task" } } };
    },
    canView: (_viewer, access) => access.ownerId === "owner",
  });
  assert.equal(result.ok, true);
  assert.equal(receivedActor.canAccessJournalism, true);
  assert.equal(result.task.id, "task");
});

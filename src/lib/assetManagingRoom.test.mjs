import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { planManagingRoomChange } from "./assetManagingRoom.mjs";

const assignment = (overrides = {}) => ({ department_id: "dept-a", assignee_id: null, ...overrides });

test("plans managing-room changes from the current assignment", () => {
  assert.deepEqual(planManagingRoomChange({ currentAssignment: null, status: "available", selectedDepartmentId: "dept-a" }), { action: "assign", clearsAssignee: false });
  assert.deepEqual(planManagingRoomChange({ currentAssignment: assignment(), status: "available", selectedDepartmentId: "dept-b" }), { action: "transfer", clearsAssignee: false });
  assert.deepEqual(planManagingRoomChange({ currentAssignment: assignment(), status: "available", selectedDepartmentId: "dept-a" }), { action: null, clearsAssignee: false });
  assert.deepEqual(planManagingRoomChange({ currentAssignment: null, status: "available", selectedDepartmentId: "" }), { action: null, clearsAssignee: false });
  assert.deepEqual(planManagingRoomChange({ currentAssignment: assignment(), status: "liquidated", selectedDepartmentId: "dept-b" }), { action: null, clearsAssignee: false });
  assert.equal(planManagingRoomChange({ currentAssignment: assignment({ assignee_id: "person-a" }), status: "available", selectedDepartmentId: "dept-b" }).clearsAssignee, true);
  assert.equal(planManagingRoomChange({ currentAssignment: assignment(), status: "available", selectedDepartmentId: "dept-b" }).clearsAssignee, false);
});

test("asset detail exposes managing-room edit guarded by asset.manage", () => {
  const page = readFileSync(new URL("../app/assets/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /canManage[\s\S]*aria-label="Phòng đang quản lý"/);
  assert.match(page, /fetch\("\/api\/assets"[\s\S]*assignee_id:\s*null/);
  assert.match(page, /<input readOnly className=.*value=\{currentDepartment\}/);
});

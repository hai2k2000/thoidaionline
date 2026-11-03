import assert from "node:assert/strict";
import test from "node:test";
import { isCollaboratorRole, isCollaboratorAllowedPath } from "./collaboratorRole.mjs";
test("recognizes only the collaborator role", () => { assert.equal(isCollaboratorRole("cong_tac_vien"), true); assert.equal(isCollaboratorRole("nhan_vien"), false); });
test("collaborators can reach task and account paths only", () => {
  const id = "12345678-1234-4234-8234-123456789012";
  assert.equal(isCollaboratorAllowedPath("/my-tasks"), true); assert.equal(isCollaboratorAllowedPath(`/tasks/${id}`), true); assert.equal(isCollaboratorAllowedPath("/account"), true);
  assert.equal(isCollaboratorAllowedPath("/attendance"), false); assert.equal(isCollaboratorAllowedPath("/api/attendance"), false); assert.equal(isCollaboratorAllowedPath("/users"), false);
  assert.equal(isCollaboratorAllowedPath("/api/tasks", "POST"), false); assert.equal(isCollaboratorAllowedPath(`/api/tasks/${id}`, "GET"), true); assert.equal(isCollaboratorAllowedPath(`/api/tasks/${id}/comments`, "POST"), true); assert.equal(isCollaboratorAllowedPath(`/api/tasks/${id}/journalism`), false);
});

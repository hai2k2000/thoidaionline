import assert from "node:assert/strict";
import test from "node:test";
import { isCollaboratorRole, isCollaboratorAllowedPath } from "./collaboratorRole.mjs";
test("recognizes only the collaborator role", () => { assert.equal(isCollaboratorRole("cong_tac_vien"), true); assert.equal(isCollaboratorRole("nhan_vien"), false); });
test("collaborators can reach task and account paths", () => {
  const id = "12345678-1234-4234-8234-123456789012";
  assert.equal(isCollaboratorAllowedPath("/my-tasks"), true); assert.equal(isCollaboratorAllowedPath(`/tasks/${id}`), true); assert.equal(isCollaboratorAllowedPath("/account"), true);
  assert.equal(isCollaboratorAllowedPath("/attendance"), false); assert.equal(isCollaboratorAllowedPath("/api/attendance"), false); assert.equal(isCollaboratorAllowedPath("/users"), false);
  assert.equal(isCollaboratorAllowedPath("/api/tasks", "POST"), false); assert.equal(isCollaboratorAllowedPath(`/api/tasks/${id}`, "GET"), true); assert.equal(isCollaboratorAllowedPath(`/api/tasks/${id}/comments`, "POST"), true); assert.equal(isCollaboratorAllowedPath(`/api/tasks/${id}/journalism`), false);
});

test("collaborators can read projects but cannot use project management routes", () => {
  const id = "12345678-1234-4234-8234-123456789012";
  for (const path of ["/projects", `/projects/${id}`]) assert.equal(isCollaboratorAllowedPath(path), true, path);
  for (const path of ["/api/projects", `/api/projects/${id}`, `/api/projects/${id}/members`, `/api/projects/${id}/tasks`, "/api/projects/access"]) {
    assert.equal(isCollaboratorAllowedPath(path, "GET"), true, path);
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) assert.equal(isCollaboratorAllowedPath(path, method), false, `${method} ${path}`);
  }
  for (const path of ["/projects/new", "/projects/not-a-uuid", `/projects/${id}/edit`, "/api/projects/options"]) assert.equal(isCollaboratorAllowedPath(path), false, path);
});

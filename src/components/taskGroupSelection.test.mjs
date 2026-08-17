import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync(new URL("./TaskAssignShell.tsx", import.meta.url), "utf8");
const factory = readFileSync(new URL("../lib/taskHandlerFactory.ts", import.meta.url), "utf8");
const handlers = readFileSync(new URL("../lib/taskHandlers.ts", import.meta.url), "utf8");

test("assignment UI restores department group preview and per-member include/exclude", () => {
  assert.match(shell, /Cá nhân/);
  assert.match(shell, /Nhóm phòng ban/);
  assert.match(shell, /Danh sách thành viên active/);
  assert.match(shell, /excludedMemberIds/);
  assert.match(shell, /groupDepartmentId/);
  assert.match(shell, /type="checkbox"/);
  assert.match(shell, /Người chịu trách nhiệm chính/);
});

test("handler resolves canonical participants before assigning and recurrence snapshot", () => {
  assert.match(factory, /resolveAssignmentParticipants/);
  assert.match(factory, /groupDepartmentId/);
  assert.match(factory, /excludedMemberIds/);
  assert.match(factory, /resolved\.collaboratorIds/);
  assert.match(handlers, /taskAssignmentRepository\.resolveParticipants/);
});

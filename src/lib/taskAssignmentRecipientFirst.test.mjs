import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync(new URL("../components/TaskAssignShell.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/tasks/assign/page.tsx", import.meta.url), "utf8");
const repository = readFileSync(new URL("./taskAssignmentRepository.ts", import.meta.url), "utf8");

test("general assignment starts with recipient selection and keeps the form gated", () => {
  assert.match(shell, /CHỌN NGƯỜI NHẬN VIỆC/);
  assert.match(shell, /Vui lòng chọn người nhận việc trước/);
  assert.match(shell, /formActivated/);
  assert.match(shell, /titleInputRef/);
});

test("recipient change preserves mounted task content", () => {
  assert.match(shell, /Đổi người/);
  assert.match(shell, /setAssigneeId\(""\)/);
  assert.match(shell, /disabled=\{!recipientReady\}/);
  assert.doesNotMatch(shell, /reset\(\)|event\.currentTarget\.reset/);
});

test("manager UI has no general department selector and TBT can explicitly switch scope", () => {
  assert.match(shell, /Phạm vi:/);
  assert.match(shell, /Chọn phòng ban khác/);
  assert.match(shell, /Quay về Ban Biên tập/);
  assert.match(shell, /assignmentScope\.canChooseOtherDepartment/);
});

test("server page passes a repository-derived assignment scope", () => {
  assert.match(repository, /deriveAssignmentScope/);
  assert.match(page, /assignmentScope=\{options\.scope\}/);
  assert.doesNotMatch(page, /departmentId:\s*["'][0-9a-f-]{36}["']/i);
});

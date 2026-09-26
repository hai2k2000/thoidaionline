import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync(new URL("../components/TaskAssignShell.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/tasks/assign/page.tsx", import.meta.url), "utf8");
const repository = readFileSync(new URL("./taskAssignmentRepository.ts", import.meta.url), "utf8");

test("general assignment starts with a compact interaction-only recipient picker", () => {
  assert.match(shell, /CHỌN NGƯỜI NHẬN VIỆC/);
  assert.match(shell, /role="combobox"/);
  assert.match(shell, /aria-expanded=\{recipientPickerOpen\}/);
  assert.match(shell, /recipientPickerOpen && departmentId/);
  assert.match(shell, /aria-autocomplete="list"/);
  assert.match(shell, /Tìm hoặc chọn nhân viên/);
  assert.match(shell, /filteredRecipientPeople/);
  assert.doesNotMatch(shell, /sm:grid-cols-2 lg:grid-cols-3/);
  assert.match(shell, /disabled=\{!recipientReady\}/);
});

test("recipient selection collapses, focuses Việc 1, and change preserves mounted task content", () => {
  assert.match(shell, /Đang giao việc cho:/);
  assert.match(shell, /Đổi người/);
  assert.match(shell, /focusCardTitle\(taskCards\[0\]\?\.cardId/);
  assert.match(shell, /setAssigneeId\(""\)/);
  assert.match(shell, /setFormActivated\(false\)/);
  assert.doesNotMatch(shell, /reset\(\)|event\.currentTarget\.reset/);
});

test("manager scope stays inline while TBT and PTBT can explicitly switch departments", () => {
  assert.match(shell, /Phạm vi:/);
  assert.match(shell, /Tìm người trong Ban Biên tập/);
  assert.match(shell, /Chọn phòng ban khác/);
  assert.match(shell, /Quay về Ban Biên tập/);
  assert.match(shell, /assignmentScope\.canChooseOtherDepartment/);
});

test("server page passes a repository-derived assignment scope", () => {
  assert.match(repository, /deriveAssignmentScope/);
  assert.match(page, /assignmentScope=\{options\.scope\}/);
  assert.doesNotMatch(page, /departmentId:\s*["'][0-9a-f-]{36}["']/i);
});

test("participant selectors are compact, searchable, and preserve the existing payload fields", () => {
  assert.match(shell, /ParticipantSelector/);
  assert.match(shell, /label="Người phối hợp"/);
  assert.match(shell, /label="Người theo dõi"/);
  assert.match(shell, /Tìm theo tên nhân viên/);
  assert.match(shell, /pointerdown/);
  assert.match(shell, /event\.key === "Escape"/);
  assert.match(shell, /openPanel === panel/);
  assert.match(shell, /collaboratorIds: ids/);
  assert.match(shell, /watcherIds: ids/);
  assert.doesNotMatch(shell, /participantIds/);
});

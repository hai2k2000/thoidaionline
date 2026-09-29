import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync(new URL("../components/TaskAssignShell.tsx", import.meta.url), "utf8");
const form = readFileSync(new URL("../components/CanonicalAssignmentForm.tsx", import.meta.url), "utf8");
const assignment = shell + form;
const page = readFileSync(new URL("../app/tasks/assign/page.tsx", import.meta.url), "utf8");
const repository = readFileSync(new URL("./taskAssignmentRepository.ts", import.meta.url), "utf8");

test("general assignment starts with a compact interaction-only recipient picker", () => {
  assert.match(assignment, /CHỌN NGƯỜI NHẬN VIỆC/);
  assert.match(assignment, /role="combobox"/);
  assert.match(assignment, /aria-expanded=\{recipientPickerOpen\}/);
  assert.match(assignment, /recipientPickerOpen && departmentId/);
  assert.match(assignment, /aria-autocomplete="list"/);
  assert.match(assignment, /Tìm hoặc chọn nhân viên/);
  assert.match(assignment, /filteredRecipientPeople/);
  assert.doesNotMatch(assignment, /sm:grid-cols-2 lg:grid-cols-3/);
  assert.match(assignment, /disabled=\{!recipientReady/);
});

test("recipient selection collapses, focuses Việc 1, and change preserves mounted task content", () => {
  assert.match(assignment, /Đang giao việc cho:/);
  assert.match(assignment, /Đổi người/);
  assert.match(assignment, /cardTitleRefs\.current\[taskCards\[0\]\?\.cardId\]/);
  assert.match(assignment, /setAssigneeId\(""\)/);
  assert.match(assignment, /setFormActivated\(false\)/);
  assert.doesNotMatch(assignment, /reset\(\)|event\.currentTarget\.reset/);
});

test("manager scope stays inline while TBT and PTBT can explicitly switch departments", () => {
  assert.match(assignment, /Phạm vi:/);
  assert.match(assignment, /Tìm người trong Ban Biên tập/);
  assert.match(assignment, /Chọn phòng ban khác/);
  assert.match(assignment, /Quay về Ban Biên tập/);
  assert.match(assignment, /assignmentScope\?\.canChooseOtherDepartment/);
});

test("server page passes a repository-derived assignment scope", () => {
  assert.match(repository, /deriveAssignmentScope/);
  assert.match(page, /assignmentScope=\{options\.scope\}/);
  assert.doesNotMatch(page, /departmentId:\s*["'][0-9a-f-]{36}["']/i);
});

test("participant selectors are compact, searchable, and preserve the existing payload fields", () => {
  assert.match(assignment, /ParticipantSelector/);
  assert.match(assignment, /label="Người phối hợp"/);
  assert.match(assignment, /label="Người theo dõi"/);
  assert.match(assignment, /Tìm theo tên nhân viên/);
  assert.match(assignment, /pointerdown/);
  assert.match(assignment, /event\.key === "Escape"/);
  assert.match(assignment, /openPanel === panel/);
  assert.match(assignment, /collaboratorIds: ids/);
  assert.match(assignment, /watcherIds: ids/);
  assert.doesNotMatch(assignment, /participantIds/);
});

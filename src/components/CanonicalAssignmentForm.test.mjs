import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (name) => readFile(new URL(`./${name}`, import.meta.url), "utf8");

test("TaskAssignShell delegates the general assignment form to the reusable component", async () => {
  const shell = await read("TaskAssignShell.tsx");
  assert.match(shell, /CanonicalAssignmentForm/);
  assert.match(shell, /onSubmit=\{submitCanonical\}/);
  assert.match(shell, /\/api\/tasks\/assign/);
  assert.match(shell, /router\.push/);
  assert.match(shell, /uploadBatchAttachments/);
});

test("canonical form owns recipient scope, defaults, fields, validation, and payload normalization", async () => {
  const form = await read("CanonicalAssignmentForm.tsx");
  for (const marker of [
    "initialValues",
    "onSubmit",
    "onCancel",
    "departmentId",
    "assigneeId",
    "dueDate",
    "dueTime",
    "description",
    "requirements",
    "priority",
    "collaboratorIds",
    "watcherIds",
    "validateTaskCards",
    "buildBatchPayload",
    "Tìm hoặc chọn nhân viên",
    "Phòng ban:",
    "Đổi người",
    "role=\"combobox\"",
    "Escape",
    "pointerdown",
    "onCancel",
  ]) assert.match(form, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), marker);
  assert.match(form, /createTaskCard\(`card-\$\{index \+ 1\}`\)/);
  assert.match(form, /createTaskCard/);
});

test("initial values cover compatible canonical fields and submit remains caller-owned", async () => {
  const form = await read("CanonicalAssignmentForm.tsx");
  for (const field of ["title", "content", "description", "requirements", "dueDate", "dueTime", "priority", "collaboratorIds", "watcherIds"]) {
    assert.match(form, new RegExp(`${field}\\?:`), field);
  }
  assert.match(form, /await onSubmit\(\{[^}]*payload/s);
  assert.match(form, /type=\"button\"[^>]*onClick=\{onCancel\}/);
});

test("auto-focuses the first card only when the active recipient is ready", async () => {
  const form = await read("CanonicalAssignmentForm.tsx");
  assert.match(form, /if \(formActivated && recipientReady\)\s*window\.requestAnimationFrame\(\(\) => cardTitleRefs\.current\[firstCardIdRef\.current \?\? ""\]\?\.focus\(\)\)/);
  assert.match(form, /\}, \[formActivated, recipientReady\]\);/);
  assert.doesNotMatch(form, /\}, \[[^\]]*taskCards[^\]]*\]\);/);
});

test("recipient controls render in mode, department, recipient order before task cards", async () => {
  const form = await read("CanonicalAssignmentForm.tsx");
  const modeIndex = form.indexOf("Cách giao");
  const departmentIndex = form.indexOf("Phòng ban");
  const recipientIndex = form.indexOf("Người nhận việc");
  const taskCardIndex = form.indexOf("aria-label=\"Danh sách công việc\"");
  assert.ok(modeIndex >= 0 && departmentIndex > modeIndex && recipientIndex > departmentIndex);
  assert.ok(taskCardIndex > recipientIndex);
  assert.match(form, /type="radio"/);
  assert.match(form, /department_group/);
  assert.match(form, /disabled=\{mode === "department_group" && taskCards\.length > 1\}/);
});

test("department changes clear the selected recipient and activation while mode switches reset exclusions", async () => {
  const form = await read("CanonicalAssignmentForm.tsx");
  assert.match(form, /const handleDepartmentChange[\s\S]*setDepartmentId\(nextDepartmentId\)[\s\S]*setAssigneeId\(""\)[\s\S]*setExcludedMemberIds\(\[\]\)[\s\S]*setFormActivated\(false\)/);
  assert.match(form, /setAssignmentMode\(nextMode\);[\s\S]{0,120}setExcludedMemberIds\(\[\]\)/);
  assert.match(form, /assignmentMode === "department_group" \? `Nhóm phòng ban — chính: \$\{selectedAssignee\.fullName\}`/);
  assert.doesNotMatch(form, /<Field label="Cách chọn người">/);
});

test("department group summary keeps the editable member checklist visible", async () => {
  const form = await read("CanonicalAssignmentForm.tsx");
  assert.match(form, /formActivated && selectedAssignee && selectedDepartment[\s\S]*assignmentMode === "department_group" && formActivated[\s\S]*groupMemberChecklist/);
});

test("shell keeps API, attachment, notification, and redirect lifecycle outside the reusable form", async () => {
  const shell = await read("TaskAssignShell.tsx");
  assert.match(shell, /responseErrorMessage/);
  assert.match(shell, /notify\(/);
  assert.match(shell, /\/api\/tasks\/\$\{result\.task\.id\}\/attachments/);
  assert.match(shell, /router\.refresh\(\)/);
  assert.match(shell, /\/tasks/);
});

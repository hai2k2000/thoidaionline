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
    "Phạm vi:",
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

test("shell keeps API, attachment, notification, and redirect lifecycle outside the reusable form", async () => {
  const shell = await read("TaskAssignShell.tsx");
  assert.match(shell, /responseErrorMessage/);
  assert.match(shell, /notify\(/);
  assert.match(shell, /\/api\/tasks\/\$\{result\.task\.id\}\/attachments/);
  assert.match(shell, /router\.refresh\(\)/);
  assert.match(shell, /\/tasks/);
});

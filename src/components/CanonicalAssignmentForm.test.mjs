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
    "onCancel",
  ]) assert.match(form, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), marker);
  assert.match(form, /createTaskCard\(`card-\$\{index \+ 1\}`\)/);
  assert.match(form, /createTaskCard/);
  assert.match(await read("ParticipantSelector.tsx"), /pointerdown/);
});

test("project assignment enables optional deadline and normalizes nullable dates", async () => {
  const shell = await read("ProjectDetailShell.tsx");
  assert.match(shell, /projectMode=\{\{[\s\S]*\}\} optionalDeadline/);
  const form = await read("CanonicalAssignmentForm.tsx");
  assert.match(form, /dueDate: taskCards\[0\]\.dueDate \|\| null/);
  assert.match(form, /dueTime: taskCards\[0\]\.dueDate \? taskCards\[0\]\.dueTime \|\| "17:00" : null/);
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

test("project single-card submit executes nullable payload normalization", async () => {
 const form=await read("CanonicalAssignmentForm.tsx");
 const expression=form.match(/const payload = ([\s\S]*?);\r?\n    try/)[1];
 const build=new Function("taskCards","projectMode", "const singleTaskOnly=true,departmentId='host',assigneeId='member',reviewerId='lead',assignmentMode='individual',excludedMemberIds=[];return "+expression);
 for(const [dueDate,dueTime,wantDate,wantTime] of [["","",null,null],["","17:00",null,null],["2026-11-10","","2026-11-10","17:00"],["2026-11-10","09:30","2026-11-10","09:30"]]) {
  const payload=build([{title:'Task',description:'Details',requirements:[],dueDate,dueTime}],{});
  assert.equal(payload.dueDate,wantDate);assert.equal(payload.dueTime,wantTime);assert.equal(payload.reviewerId,'lead');
 }
});
test("project deadline sorting puts undated tasks last without mutating input", async()=>{
 const shell=await read("ProjectDetailShell.tsx");
 const expression=shell.match(/const visibleTasks=([^;]+);/)[1];
 const sort=new Function('tasks',"const status='',assignee='';return "+expression);
 const tasks=[{id:'none1',due_date:null},{id:'late',due_date:'2026-11-12'},{id:'none2',due_date:null},{id:'early',due_date:'2026-11-10'}];
 assert.deepEqual(sort(tasks).map(t=>t.id),['early','late','none1','none2']);
 assert.equal(tasks[0].id,'none1');
 assert.ok(shell.includes("Kh\u00f4ng c\u00f3 h\u1ea1n"));
});

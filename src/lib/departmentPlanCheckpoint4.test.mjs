import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("bulk grid exposes only the approved compact columns", () => {
  const source = read("../components/DepartmentPlanGrid.tsx");
  for (const label of ["STT", "Nội dung công việc", "Người thực hiện", "Hạn hoàn thành", "Trạng thái", "Thao tác"]) assert.match(source, new RegExp(label));
  for (const forbidden of ["description", "requirements", "collaborators", "watchers", "attachments", "created_at", "updated_at"]) assert.doesNotMatch(source, new RegExp(`>${forbidden}<`, "i"));
  assert.match(source, /index \+ 1/);
});

test("quick entry keeps add local and creates the parent only during save", () => {
  const source = read("../components/DepartmentPlanGrid.tsx");
  const addBlock = source.slice(source.indexOf("+ Thêm dòng") - 500, source.indexOf("+ Thêm dòng") + 300);
  assert.doesNotMatch(addBlock, /fetch\(/);
  assert.match(source, /api\/planning\/department.*method: "POST"/);
  assert.match(source, /api\/planning\/department\/\$\{currentPlan\.id\}\/items/);
  assert.match(source, /method: "PATCH"/);
  assert.match(source, /method: "DELETE"/);
});

test("assignment states remain separate from work status and support valid unassigned modes", () => {
  const source = read("../components/DepartmentPlanGrid.tsx");
  assert.match(source, /unassigned/);
  assert.match(source, /department_wide/);
  assert.match(source, /assignment_state/);
  assert.match(source, /work_status/);
  assert.match(source, /Việc chung của phòng/);
  assert.match(source, /planned/);
});

test("quick entry warns for outside-period due dates and protects unsaved navigation", () => {
  const source = read("../components/DepartmentPlanGrid.tsx");
  assert.match(source, /Hạn hoàn thành nằm ngoài kỳ kế hoạch/);
  assert.match(source, /Bạn có nội dung chưa lưu/);
  assert.match(source, /beforeunload/);
});

test("quick entry does not create Plan-to-Task behavior", () => {
  const source = read("../components/DepartmentPlanGrid.tsx");
  assert.doesNotMatch(source, /\/api\/tasks|createTask|taskId/);
});

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("Phase 4 Task Center is server-filtered and responsive", () => {
  const page = read("../app/tasks/page.tsx");
  const shell = read("../components/TaskCenterShell.tsx");
  assert.match(page, /parseTaskListSearchParams/);
  assert.match(page, /taskRepository\.list/);
  assert.match(page, /getSessionUser/);
  assert.doesNotMatch(page, /@\/lib\/supabase/);
  assert.match(shell, /\+ Tạo công việc/);
  assert.match(shell, /href="\/tasks\/personal\/new"/);
  assert.doesNotMatch(shell, /href="\/tasks\/assign"/);
  assert.match(shell, /space-y-3 lg:hidden/);
  assert.match(shell, /hidden overflow-x-auto lg:block/);
  assert.match(shell, /name="scope"/);
  assert.match(shell, /name="q"/);
  assert.match(shell, /name="state"/);
  assert.match(shell, /name="deadline"/);
});

test("personal task UI and same-origin API routes exist", () => {
  const form = read("../components/PersonalTaskForm.tsx");
  const actions = read("../components/PersonalTaskActions.tsx");
  const personalRoute = read("../app/api/tasks/personal/route.ts");
  const itemRoute = read("../app/api/tasks/[id]/personal/route.ts");
  const deadlineRoute = read("../app/api/tasks/[id]/deadline/route.ts");
  const cancelRoute = read("../app/api/tasks/[id]/cancel/route.ts");
  const completeRoute = read("../app/api/tasks/[id]/complete/route.ts");
  assert.match(form, /startDate/);
  assert.match(form, /dueDate/);
  assert.match(form, /deadlineReason/);
  for (const frequency of ["daily", "weekly", "monthly"]) assert.match(form, new RegExp(frequency));
  assert.match(actions, /cancel/);
  assert.match(actions, /complete/);
  for (const route of [personalRoute, itemRoute, deadlineRoute, cancelRoute, completeRoute]) {
    assert.match(route, /taskHandlers/);
  }
});
test("Phase 4 migration is additive and service-role only", () => {
  const migration = read("../../supabase/migrations/20260817060000_phase4_personal_task_workflow.sql");
  assert.doesNotMatch(migration, /\b(?:drop|truncate|delete\s+from)\b/i);
  assert.match(migration, /api_change_personal_task_deadline/);
  assert.match(migration, /task_deadline_history/);
  assert.match(migration, /task_status_events/);
  assert.match(migration, /audit_logs/);
  assert.match(migration, /from public,anon,authenticated/);
  assert.match(migration, /to service_role/);
});

test("personal recurrence and admin full edit are server-authorized and audited", () => {
  const migration = read("../../supabase/migrations/20260820133000_personal_recurrence_admin_task_edit.sql");
  const adminForm = read("../components/AdminTaskEditForm.tsx");
  assert.match(migration, /api_create_personal_task_v2/);
  assert.match(migration, /r\.code='admin'/);
  assert.match(migration, /audit_logs/);
  assert.match(migration, /task_deadline_history/);
  assert.match(adminForm, /Lý do chỉnh sửa/);
});

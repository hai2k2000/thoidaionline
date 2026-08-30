import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("Phase 6 assignment page is server-scoped and renders the full canonical form", () => {
  const page = read("../app/tasks/assign/page.tsx");
  const shell = read("./TaskAssignShell.tsx");
  assert.match(page, /getSessionUser/);
  assert.match(page, /taskAssignmentRepository/);
  assert.doesNotMatch(page, /@\/lib\/supabase/);
  for (const field of ["title", "requirements", "departmentId", "assigneeId", "dueDate", "dueTime", "recurrenceEndsOn", "attachment"]) {
    assert.match(shell, new RegExp(`name=["']${field}["']`), `${field} field missing`);
  }
  assert.doesNotMatch(shell, /AI provider|progress_percent/i);
  assert.match(shell, /value="daily">Hàng ngày/);
  assert.match(shell, /type="checkbox"/);
  assert.doesNotMatch(shell, /Giữ Ctrl\/Cmd/);
  assert.match(shell, /Trưởng phòng/);
});

test("assignment and recurrence stay behind thin server-only routes", () => {
  const assign = read("../app/api/tasks/assign/route.ts");
  const runner = read("../app/api/task-recurrence/run/route.ts");
  assert.match(assign, /taskHandlers\.assign/);
  assert.match(runner, /runTaskRecurrence/);
  assert.doesNotMatch(assign + runner, /@\/lib\/supabase/);
});

test("recurrence runner ships as an idempotent systemd timer without browser credentials", () => {
  const runner = read("../../scripts/run-task-recurrence.mjs");
  const service = read("../../deploy/systemd/thoidai-task-recurrence.service");
  const timer = read("../../deploy/systemd/thoidai-task-recurrence.timer");
  assert.match(runner, /RECURRENCE_RUNNER_SECRET/);
  assert.match(service, /Type=oneshot/);
  assert.match(timer, /OnCalendar/);
  assert.doesNotMatch(runner + service + timer, /SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC/);
});

test("Phase 6 migration is additive, audited, manager-safe and service-role only", () => {
  const sql = read("../../supabase/migrations/20260817080000_phase6_assign_watcher_recurrence.sql");
  assert.doesNotMatch(sql, /\b(?:drop|truncate|delete\s+from)\b/i);
  assert.match(sql, /api_assign_task/);
  assert.match(sql, /api_run_task_recurrence/);
  assert.match(sql, /manager_id/);
  assert.match(sql, /'watcher','todo'/);
  assert.match(sql, /task_recurrence_occurrences/);
  assert.match(sql, /audit_logs/);
  assert.match(sql, /from public,anon,authenticated/);
});

test("assignment extension supports daily recurrence, department reviewers and due time", () => {
  const sql = read("../../supabase/migrations/20260820090000_task_assignment_reviewer_daily_due_time.sql");
  assert.match(sql, /'daily','weekly','monthly'/);
  assert.match(sql, /due_time time without time zone/);
  assert.match(sql, /truong_phong','pho_truong_phong/);
  assert.match(sql, /api_assign_task_v2/);
  assert.doesNotMatch(sql, /delete\s+from|truncate/i);
});

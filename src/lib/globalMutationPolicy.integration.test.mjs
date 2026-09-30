import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("leave API exposes edit and routes mutation to guarded RPC", () => {
  const route = read("../app/api/leave-requests/route.ts");
  assert.match(route, /action === "edit"/);
  assert.match(route, /api_edit_leave_request/);
});

test("personal schedule cancel uses revision-aware RPC instead of hard delete", () => {
  const route = read("../app/api/work-schedule/personal/route.ts");
  const repo = read("./workScheduleRepository.ts");
  assert.match(route, /workflowRevision/);
  assert.match(repo, /api_cancel_personal_work_schedule/);
  const personalRemove = repo.slice(repo.indexOf("async removePersonal"), repo.indexOf("async removeOrganization"));
  assert.doesNotMatch(personalRemove, /\.delete\(\)/);
});

test("task and journalism task mutations use shared creator policy", () => {
  const auth = read("./authorization.ts");
  const taskUi = read("../components/TaskCenterShell.tsx");
  assert.match(auth, /creatorMutationPolicy/);
  assert.match(taskUi, /canEditCreatorMutation/);
  assert.doesNotMatch(taskUi, /currentUserRole === "admin"\) return task\.status !== "cancelled"/);
  const actions = read("../components/PersonalTaskActions.tsx");
  assert.match(actions, /taskType === "assigned"/);
  assert.match(actions, /`\/tasks\/\$\{taskId\}`/);
});

test("personal schedule UI delegates lifecycle decisions to the shared policy", () => {
  const shell = read("../components/WorkSchedulePageShell.tsx");
  assert.match(shell, /creatorMutationPolicy/);
  assert.match(shell, /personalScheduleLifecycleState/);
  assert.match(shell, /canEditCreatorMutation/);
});

test("task RPC migration applies one guard to every edit/cancel/deadline path", () => {
  const migration = read("../../supabase/migrations/20260930110000_global_task_creator_mutation_policy.sql");
  for (const rpc of ["api_update_task", "api_edit_personal_task", "api_cancel_personal_task", "api_cancel_assigned_task", "api_change_personal_task_deadline", "api_change_assigned_task_deadline"]) {
    assert.match(migration, new RegExp(`function public\.${rpc}`));
  }
  assert.match(migration, /api_assert_task_creator_mutation/);
  assert.match(migration, /status='cancelled'/);
  assert.match(migration, /task_status_events/);
  assert.match(migration, /audit_logs/);
  assert.doesNotMatch(migration, /delete\s+from/i);
});

test("migration contains fail-closed shared guard and audit actions", () => {
  const migration = read("../../supabase/migrations/20260930100000_global_creator_mutation_policy.sql");
  assert.match(migration, /api_assert_creator_mutation/);
  assert.match(migration, /api_edit_leave_request/);
  assert.match(migration, /api_cancel_personal_work_schedule/);
  assert.match(migration, /audit_logs/);
  assert.doesNotMatch(migration, /drop\s+(table|column)/i);
});

test("admin edit path preserves cancelled-task immutability", () => {
  const migration = read("../../supabase/migrations/20260930120000_global_mutation_cancelled_admin_guard.sql");
  assert.match(migration, /api_admin_edit_task/);
  assert.match(migration, /api_assert_task_creator_mutation\(p_actor_id,p_task_id,'edit'\)/);
  assert.match(migration, /revoke all on function public\.api_admin_edit_task_unchecked/);
});

test("admin edit wrapper also uses the shared task guard", () => {
  const migration = read("../../supabase/migrations/20260930120000_global_mutation_cancelled_admin_guard.sql");
  assert.match(migration, /api_assert_task_creator_mutation\(p_actor_id,p_task_id,'edit'\)/);
  assert.match(migration, /revoke all on function public\.api_admin_edit_task_unchecked[\s\S]*from public,anon,authenticated,service_role/);
});

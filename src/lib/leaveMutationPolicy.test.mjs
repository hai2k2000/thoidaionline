import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("leave mutation policy exposes pending edit/cancel and admin override RPC paths", () => {
  const migration = read("../../supabase/migrations/20260930100000_global_creator_mutation_policy.sql");
  assert.match(migration, /api_edit_leave_request/);
  assert.match(migration, /p_requester_id|v_old\.requester_id/);
  assert.match(migration, /p_lifecycle_state='APPROVED'/);
  assert.match(migration, /p_lifecycle_state='CANCELLED'/);
  assert.match(migration, /edit_leave_request/);
  assert.match(migration, /cancel_leave_request/);
});

test("leave API keeps edit and cancel behind authenticated mutation actor", () => {
  const route = read("../app/api/leave-requests/route.ts");
  assert.match(route, /requireMutationActor/);
  assert.match(route, /action === "edit"/);
  assert.match(route, /action === "cancel"/);
  assert.match(route, /api_edit_leave_request/);
  assert.match(route, /api_cancel_leave_request/);
});

test("personal schedule UI delegates edit/cancel state to the shared policy", () => {
  const shell = read("../components/WorkSchedulePageShell.tsx");
  assert.match(shell, /canEditCreatorMutation/);
  assert.match(shell, /personalScheduleLifecycleState/);
  assert.match(shell, /workflowRevision/);
});

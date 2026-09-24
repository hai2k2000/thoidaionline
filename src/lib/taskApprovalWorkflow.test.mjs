import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = "supabase/migrations/20260924120000_task_approval_gates.sql";
const read = (path) => readFileSync(path, "utf8");

test("approval migration is additive and preserves legacy defaults", () => {
  const sql = read(migrationPath);
  assert.match(sql, /add column if not exists approval_required boolean not null default false/i);
  assert.match(sql, /'waiting'[\s\S]*approval_required/);
  assert.match(sql, /'pending_review'/);
  assert.match(sql, /approval_required boolean not null default false/i);
});

test("approval transitions record status events and audit actions", () => {
  const sql = read(migrationPath);
  for (const action of ["submit_assignment_approval", "approve_assignment", "reject_assignment", "submit_completion", "approve_completion", "request_rework"]) {
    assert.match(sql, new RegExp(action));
  }
  assert.match(sql, /insert into public\.task_status_events/i);
  assert.match(sql, /insert into public\.audit_logs/i);
  assert.match(sql, /p_decision='reject'\s+and nullif\(btrim\(p_reason\),''\) is null/i);
  assert.match(sql, /v_status:=case when p_decision='approve' then 'in_progress' else 'rejected' end/i);
  assert.match(sql, /v_status:=case when p_decision='approve' then 'done' else 'in_progress' end/i);
});

test("approval scope blocks self approval and limits manager queues", () => {
  const sql = read(migrationPath);
  assert.match(sql, /p_actor_id\s*=\s*v\.created_by[\s\S]*v_allowed:=false/i);
  assert.match(sql, /v_department\s*=\s*v\.department_id/i);
  assert.match(sql, /if v\.approval_required then/i);
  assert.match(sql, /Department requires a primary manager/i);
});

test("recurring personal tasks keep the approval gate", () => {
  const sql = read(migrationPath);
  assert.match(sql, /task_type='personal' then 'waiting' else 'new'/i);
  assert.match(sql, /v_rule\.task_type='personal'/i);
  assert.match(sql, /api_run_task_recurrence/);
});

test("completion cannot bypass assignment approval and legacy tasks stay direct", () => {
  const sql = read(migrationPath);
  assert.match(sql, /Assignment approval is required before completion/i);
  assert.match(sql, /update public\.tasks set status='done'/i);
  assert.match(sql, /if v_before\.approval_required then/i);
  assert.match(sql, /if v_before\.task_type<>'assigned' or v_before\.status<>'pending_review'/i);
});

test("task UI exposes both approval queues and gated completion copy", () => {
  const center = read("src/components/TaskCenterShell.tsx");
  const detail = read("src/components/TaskDetailShell.tsx");
  assert.match(center, /Chờ duyệt giao việc/);
  assert.match(center, /Chờ duyệt hoàn thành/);
  assert.match(center, /Duyệt giao việc/);
  assert.match(center, /Duyệt hoàn thành/);
  assert.match(detail, /Gửi duyệt hoàn thành/);
});

test("approval queue is server-scoped and uses existing review endpoints", () => {
  const page = read("src/app/tasks/page.tsx");
  const claimReview = read("src/app/api/tasks/claim/review/route.ts");
  const completionReview = read("src/app/api/tasks/[id]/review-completion/route.ts");
  assert.match(page, /approvalQueue/);
  assert.match(page, /is_department_manager/);
  assert.match(page, /listApprovalQueue/);
  assert.match(read("src/lib/taskRepository.ts"), /canAccessJournalism === false.*applyJournalismExcludeFilter/s);
  assert.match(claimReview, /api_approve_task_claim/);
  assert.match(completionReview, /reviewAssignedCompletion/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../../supabase/migrations/20260921120000_personal_plan_approval.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("migration adds the personal plan discriminator and approval columns", () => {
  assert.match(migration, /add column if not exists schedule_scope\s+text/i);
  assert.match(migration, /add column if not exists approval_status\s+text/i);
  assert.match(migration, /add column if not exists approver_id\s+uuid/i);
  assert.match(migration, /add column if not exists reviewed_by\s+uuid/i);
  assert.match(migration, /add column if not exists reviewed_at\s+timestamptz/i);
  assert.match(migration, /add column if not exists review_note\s+text/i);
  assert.match(migration, /add column if not exists submitted_at\s+timestamptz/i);
  assert.match(migration, /add column if not exists workflow_revision\s+bigint/i);
  assert.match(migration, /schedule_scope.*personal.*organization/is);
  assert.match(migration, /PENDING_APPROVAL.*APPROVED.*REJECTED/is);
});

test("migration preserves ambiguous legacy scope and backfills safe defaults", () => {
  assert.match(migration, /set approval_status\s*=\s*'APPROVED'/i);
  assert.match(migration, /set workflow_revision\s*=\s*0/i);
  assert.match(migration, /schedule_scope\s+is null/i);
  assert.doesNotMatch(migration, /drop table\s+.*work_schedules/i);
  assert.doesNotMatch(migration, /delete from\s+public\.work_schedules/i);
});

test("migration defines transactional personal plan RPCs and audit actions", () => {
  assert.match(migration, /api_create_personal_work_schedule/i);
  assert.match(migration, /api_review_personal_work_schedule/i);
  assert.match(migration, /for update/i);
  assert.match(migration, /workflow_revision/i);
  for (const action of ["create_personal_plan", "submit_personal_plan", "edit_personal_plan", "approve_personal_plan", "reject_personal_plan", "promote_legacy_personal_plan"]) {
    assert.match(migration, new RegExp(action));
  }
  assert.match(migration, /grant execute on function .* to service_role/i);
});

test("migration does not alter online work schedules", () => {
  assert.doesNotMatch(migration, /online_work_schedules/i);
});

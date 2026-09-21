import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../../supabase/migrations/20260921120000_personal_plan_approval.sql", import.meta.url), "utf8");
const repository = readFileSync(new URL("./workScheduleRepository.ts", import.meta.url), "utf8");

test("personal plan writes lock rows and compare workflow revisions", () => {
  assert.match(migration, /select \* into v_old[\s\S]*for update/i);
  assert.match(migration, /p_expected_revision is null or p_expected_revision <> v_old\.workflow_revision/i);
  assert.match(migration, /workflow_revision=v_old\.workflow_revision\+1/i);
  assert.match(migration, /using errcode='40001'/i);
});

test("personal plan approval history is preserved in audit snapshots", () => {
  assert.match(migration, /old_data,new_data/i);
  assert.match(migration, /create_personal_plan/);
  assert.match(migration, /submit_personal_plan/);
  assert.match(migration, /edit_personal_plan/);
  assert.match(migration, /promote_legacy_personal_plan/);
  assert.match(migration, /approve_personal_plan/);
  assert.match(migration, /reject_personal_plan/);
});

test("personal plan RPC stores only the authenticated creator as participant", () => {
  assert.match(migration, /p_participant_ids is distinct from array\[p_actor\]/i);
  assert.match(migration, /participant_ids,created_by[\s\S]*array\[p_actor\]/i);
  assert.match(migration, /participant_ids=array\[v_owner\]/i);
});

test("approver resolution ignores an inactive department manager", () => {
  assert.match(migration, /join public\.staff_users manager on manager\.id=d\.manager_id and manager\.active=true/i);
});

test("pending manager queue applies department filtering at the embedded relation", () => {
  assert.match(repository, /creator:staff_users!work_schedules_created_by_fkey!inner\(full_name,department_id\)/);
  assert.match(repository, /eq\("creator\.department_id", departmentId\)/);
});

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const migration = () => read("../../supabase/migrations/20260925111000_task_assignment_batch_rpc.sql");

test("batch RPC validates bounds and malformed payload before mutation", () => {
  const sql = migration();
  assert.match(sql, /jsonb_typeof\(p_tasks\)\s*<>\s*'array'/i);
  assert.match(sql, /cardinality\(jsonb_array_elements|jsonb_array_length\(p_tasks\)/i);
  assert.match(sql, /between\s+1\s+and\s+20/i);
  assert.match(sql, /jsonb_typeof\(v_item\)\s*<>\s*'object'/i);
  assert.match(sql, /Invalid batch task payload/i);
});

test("batch RPC reuses the existing assignment implementation inside one function transaction", () => {
  const sql = migration();
  assert.match(sql, /v_task\s*:=\s*public\.api_assign_task_v2\(/i);
  assert.match(sql, /for\s+v_item,\s*v_ordinal\s+in[\s\S]*jsonb_array_elements\(p_tasks\)\s+with\s+ordinality[\s\S]*loop/i);
  assert.match(sql, /api_assign_task_v2/i);
  assert.doesNotMatch(sql, /insert\s+into\s+public\.tasks/i);
  assert.doesNotMatch(sql, /insert\s+into\s+public\.task_assignees/i);
});

test("batch RPC persists ordered IDs and returns input order", () => {
  const sql = migration();
  assert.match(sql, /with\s+ordinality/i);
  assert.match(sql, /with\s+ordinality[\s\S]*v_task_results[\s\S]*jsonb_build_object\([\s\S]*'ordinal',\s*v_ordinal/i);
  assert.match(sql, /array_append\(v_task_ids,\s*v_task\.id\)/i);
  assert.match(sql, /task_ids\s*=\s*v_task_ids/i);
  assert.match(sql, /jsonb_build_object\([\s\S]*'title',\s*v_task\.title/i);
  assert.match(sql, /jsonb_build_object\([\s\S]*'title',\s*task\.title/i);
  assert.match(sql, /jsonb_build_object\([\s\S]*replayed/i);
});

test("batch RPC implements actor-scoped replay, conflict, and concurrent locking", () => {
  const sql = migration();
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\(/i);
  assert.match(sql, /select[\s\S]*from\s+public\.task_assignment_batch_idempotency[\s\S]*for\s+update/i);
  assert.match(sql, /request_hash\s*<>\s*v_request_hash/i);
  assert.match(sql, /batch_id_conflict/i);
  assert.match(sql, /replayed.*true/i);
  assert.match(sql, /insert\s+into\s+public\.task_assignment_batch_idempotency/i);
  assert.match(sql, /completed_at/i);
});

test("batch RPC preserves authorization and service-role boundary", () => {
  const sql = migration();
  assert.match(sql, /p_actor_id/);
  assert.match(sql, /p_department_id/);
  assert.match(sql, /p_assignee_id/);
  assert.match(sql, /api_assign_task_v2\(\s*p_actor_id/i);
  assert.match(sql, /revoke all on function public\.api_assign_task_batch_v1[\s\S]*from public,anon,authenticated/i);
  assert.match(sql, /grant execute on function public\.api_assign_task_batch_v1[\s\S]*to service_role/i);
});

test("batch RPC failure leaves no completed idempotency state", () => {
  const sql = migration();
  assert.match(sql, /update\s+public\.task_assignment_batch_idempotency[\s\S]*completed_at/i);
  assert.match(sql, /exception/i);
  assert.match(sql, /notify pgrst/i);
});

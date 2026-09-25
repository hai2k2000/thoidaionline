import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const migration = () => read("../../supabase/migrations/20260925110000_task_assignment_batch_idempotency.sql");

test("batch idempotency migration is additive and idempotent", () => {
  const sql = migration();
  assert.match(sql, /create table if not exists public\.task_assignment_batch_idempotency/i);
  assert.match(sql, /create or replace function public\.api_assign_task_batch_v1/i);
  assert.match(sql, /create index if not exists/i);
  assert.match(sql, /notify pgrst/i);
  assert.doesNotMatch(sql, /update\s+public\.tasks\s+set/i);
  assert.doesNotMatch(sql, /drop\s+(table|column)\b/i);
});

test("batch idempotency table has actor-scoped uniqueness and ordered result storage", () => {
  const sql = migration();
  assert.match(sql, /actor_id\s+uuid\s+not null/i);
  assert.match(sql, /batch_id\s+uuid\s+not null/i);
  assert.match(sql, /request_hash\s+text\s+not null/i);
  assert.match(sql, /task_ids\s+uuid\[\]\s+not null/i);
  assert.match(sql, /task_count\s+integer\s+not null/i);
  assert.match(sql, /created_at\s+timestamptz\s+not null/i);
  assert.match(sql, /completed_at\s+timestamptz/i);
  assert.match(sql, /primary key\s*\(\s*actor_id\s*,\s*batch_id\s*\)/i);
  assert.match(sql, /task_count\s+between\s+1\s+and\s+20/i);
  assert.match(sql, /references\s+public\.staff_users\s*\(\s*id\s*\)/i);
});

test("batch RPC contract is exact and service-role only", () => {
  const sql = migration();
  assert.match(sql, /api_assign_task_batch_v1\(\s*p_actor_id\s+uuid\s*,\s*p_batch_id\s+uuid\s*,\s*p_department_id\s+uuid\s*,\s*p_assignee_id\s+uuid\s*,\s*p_tasks\s+jsonb\s*\)\s*returns\s+jsonb/i);
  assert.match(sql, /raise exception\s+'feature_not_ready'/i);
  assert.match(sql, /revoke all on function public\.api_assign_task_batch_v1[\s\S]*from public,anon,authenticated/i);
  assert.match(sql, /grant execute on function public\.api_assign_task_batch_v1[\s\S]*to service_role/i);
});

test("migration does not alter existing task semantics or data", () => {
  const sql = migration();
  assert.doesNotMatch(sql, /alter\s+table\s+public\.tasks/i);
  assert.doesNotMatch(sql, /insert\s+into\s+public\.tasks/i);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.(tasks|task_assignees|audit_logs|task_status_events)/i);
});

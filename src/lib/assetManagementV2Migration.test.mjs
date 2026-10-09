import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = () => readFileSync(new URL("../../supabase/migrations/20261009100000_asset_management_v2.sql", import.meta.url), "utf8");

test("asset migration defines dedicated permissions and never depends on task-wide permission", () => {
  const sql = migration();
  assert.match(sql, /asset\.view/);
  assert.match(sql, /asset\.manage/);
  assert.doesNotMatch(sql, /can_edit_all_tasks/);
  assert.doesNotMatch(sql, /30\.9\.2026|BIÊN BẢN|inventory/i);
});

test("asset migration enforces one current assignment with a department", () => {
  const sql = migration();
  assert.match(sql, /unique\s+index[\s\S]*asset_assignments[\s\S]*where[\s\S]*status\s*=\s*'active'[\s\S]*returned_at\s+is\s+null/i);
  assert.match(sql, /department_id\s+is\s+not\s+null/i);
  assert.match(sql, /trigger[\s\S]*(closed|immutable)/i);
});

test("asset migration exposes locked transactional lifecycle RPCs", () => {
  const sql = migration();
  for (const rpc of ["api_asset_assign", "api_asset_transfer", "api_asset_return"]) {
    assert.match(sql, new RegExp(`create or replace function public\\.${rpc}`));
  }
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path\s*=\s*public,\s*pg_temp/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /assigned_department_id/i);
  assert.match(sql, /assignee_id[\s\S]*(department_id|departments)/i);
});

test("asset migration denies browser table/RPC access", () => {
  const sql = migration();
  assert.match(sql, /revoke all[\s\S]*assets[\s\S]*public,\s*anon,\s*authenticated/i);
  assert.match(sql, /revoke all[\s\S]*asset_assignments[\s\S]*public,\s*anon,\s*authenticated/i);
  assert.match(sql, /grant[\s\S]*service_role/i);
  assert.match(sql, /revoke all[\s\S]*api_asset_assign/i);
  assert.match(sql, /revoke all[\s\S]*api_asset_transfer/i);
  assert.match(sql, /revoke all[\s\S]*api_asset_return/i);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("RBAC DB helper is server-only and validates active actors", () => {
  const sql = readFileSync("supabase/migrations/20260916103000_phase1a_rbac_db_helper.sql", "utf8");
  assert.match(sql, /create or replace function public\.api_list_role_permission_grants\(p_actor_id uuid\)/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = public, pg_temp/i);
  assert.match(sql, /u\.active = true and r\.active = true/i);
  assert.match(sql, /revoke all on function public\.api_list_role_permission_grants\(uuid\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.api_list_role_permission_grants\(uuid\) to service_role/i);
});

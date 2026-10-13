import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rbac = readFileSync(new URL("../../supabase/migrations/20261015100000_rbac_v2_role_user_overrides.sql", import.meta.url), "utf8");

test("RBAC v2 protects asset management with the canonical effective resolver", () => {
  assert.match(rbac, /create or replace function public\.asset_actor_can_manage\(p_actor_id uuid\)/i);
  assert.match(rbac, /api_list_effective_permissions\(p_actor_id\)[\s\S]*asset\.manage/i);
  assert.doesNotMatch(rbac, /asset_actor_can_manage[\s\S]{0,1200}join public\.user_permission_grants/i);
});

test("RBAC v2 protects Quick Report with deny-aware effective scopes", () => {
  assert.match(rbac, /create or replace function public\.api_create_quick_report_v1/i);
  assert.match(rbac, /api_list_effective_permissions\(p_actor_id\)[\s\S]*task\.quick_report\.create/i);
});

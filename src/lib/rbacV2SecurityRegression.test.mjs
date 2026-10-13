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

test("role replacement rejects self scope widening while allowing narrowing", () => {
  assert.match(rbac, /for v_scope in select value from jsonb_array_elements_text\(v_item->'scopes'\)/i);
  assert.match(rbac, /jsonb_array_elements\(v_old\)[\s\S]*old_scope\(scope\)/i);
  assert.match(rbac, /rbac_v2_scope_not_wider_than_effective\(p_actor_id, v_code, v_scope\)/i);
  assert.match(rbac, /Self elevation is not allowed\./i);
  assert.match(rbac, /p_role_id\s*=\s*v_actor_role_id[\s\S]{0,2200}Self elevation is not allowed/i);
});

test("legacy rollback gate rejects union widening from role plus narrow direct allow", () => {
  assert.match(rbac, /rbac_v2_assert_legacy_rollback_compatible/i);
  assert.match(rbac, /effect\s*=\s*'allow'/i);
  assert.match(rbac, /role_permission_grants/i);
  assert.match(rbac, /user_permission_grants/i);
  assert.match(rbac, /legacy.*widen|widen.*legacy|scope.*broaden|broaden.*scope/i);
});

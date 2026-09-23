import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = ["20260922120000_journalism_content_department_scope.sql", "20260922123000_journalism_department_code_alignment.sql", "20260923110000_journalism_scope_hardening.sql", "20260923150000_journalism_admin_scope.sql"].map((name) => fs.readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8")).join("\n");
const hardening = fs.readFileSync(new URL("../../supabase/migrations/20260923150000_journalism_admin_scope.sql", import.meta.url), "utf8");

test("database enforces Content scope for every Journalism security-definer entry point", () => {
  assert.match(migration, /api_assert_journalism_department_scope/);
  assert.match(migration, /v_actor_department_code is distinct from 'editorial'/);
  assert.match(hardening, /v_role_code not in \('admin', 'tong_bien_tap', 'pho_tong_bien_tap'\)/);
  assert.match(hardening, /v_target_department_code is distinct from 'editorial'/);
  assert.match(migration, /api_assert_journalism_access/);
  assert.match(migration, /api_assert_journalism_structure_scope/);
  assert.match(migration, /api_assign_journalism_task_v1/);
  assert.equal((migration.match(/perform public\.api_assert_journalism_department_scope/g) ?? []).length >= 3, true);
});

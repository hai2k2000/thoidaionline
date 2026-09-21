import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("compatibility completion preserves self-service and inactive-role grants", () => {
  const sql = readFileSync("supabase/migrations/20260916104500_phase1a_rbac_compatibility_completion.sql", "utf8");
  assert.match(sql, /attendance\.view_self/);
  assert.match(sql, /leave\.view_self/);
  assert.match(sql, /schedule\.view_self/);
  for (const role of ["bien_tap_vien", "tri_su", "phu_trach_phong_bien_tap", "phu_trach_phong_phong_vien", "phu_trach_phong_tri_su"]) {
    assert.match(sql, new RegExp(role));
  }
  assert.match(sql, /on conflict \(role_id, permission_id, scope\) do nothing/i);
});

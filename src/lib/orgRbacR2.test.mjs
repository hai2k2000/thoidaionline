import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("department target validation allows active and rejects inactive or missing", async () => {
  const { validateDepartmentTarget } = await import("./userReconciliationValidation.mjs");
  assert.deepEqual(validateDepartmentTarget({ id: "d1", active: true }), { ok: true });
  assert.deepEqual(validateDepartmentTarget({ id: "d2", active: false }), { ok: false, code: "inactive_department" });
  assert.deepEqual(validateDepartmentTarget(null), { ok: false, code: "department_not_found" });
});

test("historical options preserve current inactive values without making them selectable", async () => {
  const { selectableHistoricalOptions } = await import("./userReconciliationValidation.mjs");
  const options = selectableHistoricalOptions([
    { id: "active", code: "general", name: "Phòng Tổng hợp", active: true },
    { id: "old", code: "operations", name: "Phòng Trị sự", active: false },
  ], "old");
  assert.deepEqual(options, [
    { id: "active", code: "general", name: "Phòng Tổng hợp", active: true, selectable: true, historical: false },
    { id: "old", code: "operations", name: "Phòng Trị sự", active: false, selectable: false, historical: true },
  ]);
});

test("users API validates active department targets on create and changed update", () => {
  const route = read("src/app/api/users/route.ts");
  assert.match(route, /from\("departments"\)/);
  assert.match(route, /eq\("active", true\)/);
  assert.match(route, /inactive_department/);
  assert.match(route, /department_not_found/);
});

test("users UI keeps inactive historical role and department visible but disabled", () => {
  const page = read("src/app/users/page.tsx");
  assert.match(page, /active !== false \|\| .*edit/);
  assert.match(page, /INACTIVE|HISTORICAL|đã ngừng sử dụng|lịch sử/);
  assert.match(page, /\(.*code.*\)/);
});

test("R2 label migration is guarded and does not touch grants or tasks", () => {
  const migration = read("supabase/migrations/20260917200000_org_rbac_r2_tbt_label.sql");
  assert.match(migration, /code\s*=\s*'tong_bien_tap'/);
  assert.match(migration, /Tổng biên tập \(chỉ xem công việc và nhân sự\)/);
  assert.match(migration, /Tổng biên tập/);
  assert.doesNotMatch(migration, /role_permission_grants|permissions|staff_users|tasks/);
});

test("R2 static RBAC baseline is exactly 17 permissions and 116 unique grant tuples", () => {
  const core = read("supabase/migrations/20260916100000_phase1a_rbac_core.sql");
  const compat = read("supabase/migrations/20260916104500_phase1a_rbac_compatibility_completion.sql");
  const tuple = /\('([^']+)',\s*'([^']+)',\s*'([^']+)'\)/g;
  const triples = (source) => [...source.matchAll(tuple)].map((match) => match.slice(1, 4));
  const permissions = [...core.slice(0, core.indexOf("with compatibility_grants")).matchAll(/\('([^']+)',\s*'[^']+',\s*'[^']+'\)/g)].map((match) => match[1]);
  const roles = ["admin", "tong_bien_tap", "pho_tong_bien_tap", "truong_phong", "pho_truong_phong", "phong_vien", "nhan_vien", "tbt_read_only", "bien_tap_vien", "tri_su", "phu_trach_phong_bien_tap", "phu_trach_phong_phong_vien", "phu_trach_phong_tri_su"];
  const generated = roles.flatMap((role) => ["attendance.view_self", "leave.view_self", "schedule.view_self"].map((permission) => [role, permission, "self"]));
  const startCore = core.indexOf("with compatibility_grants");
  const startCompat = compat.indexOf("with compatibility_grants");
  const expected = new Set([...triples(core.slice(startCore)), ...generated, ...triples(compat.slice(startCompat))].map((row) => row.join("|")));
  assert.equal(new Set(permissions).size, 17);
  assert.equal(expected.size, 116);
});

test("R2 has no task backfill or department-state mutation", () => {
  const migration = read("supabase/migrations/20260917200000_org_rbac_r2_tbt_label.sql");
  assert.doesNotMatch(migration, /update\s+.*tasks|department_id|active\s*=\s*(true|false)/i);
});

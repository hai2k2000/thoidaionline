import assert from "node:assert/strict";
import test from "node:test";
import { canManageDepartmentPlan, resolveDepartmentPlanScope } from "./departmentPlanAuthorization.ts";

const actor = (overrides = {}) => ({
  id: "actor", departmentId: "dep-a", roleCode: "employee", roleLevel: 1,
  isDepartmentManager: false, permissions: {}, ...overrides,
});

test("department managers are restricted to their own department", () => {
  const manager = actor({ roleCode: "truong_phong", isDepartmentManager: true });
  assert.deepEqual(resolveDepartmentPlanScope(manager), { departmentId: "dep-a", kind: "own_department" });
  assert.equal(resolveDepartmentPlanScope(manager, "dep-b"), null);
  assert.equal(canManageDepartmentPlan(manager, "dep-a"), true);
  assert.equal(canManageDepartmentPlan(manager, "dep-b"), false);
});

test("normal employees are denied Department Plan management", () => {
  const employee = actor();
  assert.equal(resolveDepartmentPlanScope(employee), null);
  assert.equal(canManageDepartmentPlan(employee, "dep-a"), false);
});

test("global roles preserve target-department authority", () => {
  for (const roleCode of ["admin", "tong_bien_tap", "pho_tong_bien_tap"]) {
    const global = actor({ roleCode });
    assert.deepEqual(resolveDepartmentPlanScope(global, "dep-b"), { departmentId: "dep-b", kind: "global" });
    assert.equal(canManageDepartmentPlan(global, "dep-b"), true);
  }
});

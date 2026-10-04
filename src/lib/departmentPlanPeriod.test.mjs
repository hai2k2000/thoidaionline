import assert from "node:assert/strict";
import test from "node:test";
import { getDepartmentPlanPeriod } from "./departmentPlanPeriod.ts";

test("weekly periods use Friday through next Friday in Vietnam time", () => {
  assert.deepEqual(getDepartmentPlanPeriod("weekly", "2026-10-02"), {
    periodType: "weekly", periodStart: "2026-10-02", periodEnd: "2026-10-09",
  });
  assert.deepEqual(getDepartmentPlanPeriod("weekly", "2026-10-04"), {
    periodType: "weekly", periodStart: "2026-10-02", periodEnd: "2026-10-09",
  });
  assert.deepEqual(getDepartmentPlanPeriod("weekly", "2026-10-09"), {
    periodType: "weekly", periodStart: "2026-10-09", periodEnd: "2026-10-16",
  });
  assert.deepEqual(getDepartmentPlanPeriod("weekly", "2026-10-10"), {
    periodType: "weekly", periodStart: "2026-10-09", periodEnd: "2026-10-16",
  });
});

test("monthly periods use local calendar boundaries", () => {
  assert.deepEqual(getDepartmentPlanPeriod("monthly", "2026-02-28"), {
    periodType: "monthly", periodStart: "2026-02-01", periodEnd: "2026-02-28",
  });
  assert.deepEqual(getDepartmentPlanPeriod("monthly", "2024-02-29"), {
    periodType: "monthly", periodStart: "2024-02-01", periodEnd: "2024-02-29",
  });
});

test("malformed dates and period types fail closed", () => {
  assert.throws(() => getDepartmentPlanPeriod("weekly", "2026-02-30"), /invalid period start/);
  assert.throws(() => getDepartmentPlanPeriod("quarterly", "2026-02-01"), /invalid period type/);
});

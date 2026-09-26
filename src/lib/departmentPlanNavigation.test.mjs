import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalPeriodFromQuery,
  departmentPlanUrl,
  formatDepartmentPlanPeriod,
  shiftDepartmentPlanStart,
} from "./departmentPlanNavigation.ts";

test("navigation canonicalizes weekly and monthly query starts", () => {
  assert.deepEqual(canonicalPeriodFromQuery("weekly", "2026-09-23"), {
    periodType: "weekly", periodStart: "2026-09-21", periodEnd: "2026-09-27",
  });
  assert.deepEqual(canonicalPeriodFromQuery("monthly", "2026-09-15"), {
    periodType: "monthly", periodStart: "2026-09-01", periodEnd: "2026-09-30",
  });
});

test("navigation handles timezone defaults near UTC midnight", () => {
  const beforeVietnamMidnight = new Date("2026-09-20T16:59:59.000Z");
  const afterVietnamMidnight = new Date("2026-09-20T17:00:00.000Z");
  assert.equal(canonicalPeriodFromQuery("weekly", null, beforeVietnamMidnight).periodStart, "2026-09-14");
  assert.equal(canonicalPeriodFromQuery("weekly", null, afterVietnamMidnight).periodStart, "2026-09-21");
});

test("navigation shifts calendar boundaries without UTC drift", () => {
  assert.equal(shiftDepartmentPlanStart("weekly", "2026-12-28", 1), "2027-01-04");
  assert.equal(shiftDepartmentPlanStart("monthly", "2026-12-01", 1), "2027-01-01");
  assert.equal(shiftDepartmentPlanStart("monthly", "2027-01-01", -1), "2026-12-01");
  assert.equal(shiftDepartmentPlanStart("monthly", "2024-02-01", 1), "2024-03-01");
});

test("period labels and URLs are canonical and shareable", () => {
  assert.equal(formatDepartmentPlanPeriod("weekly", "2026-09-21", "2026-09-27"), "21/09/2026 - 27/09/2026");
  assert.equal(formatDepartmentPlanPeriod("monthly", "2026-09-01", "2026-09-30"), "Tháng 09/2026");
  assert.equal(departmentPlanUrl("weekly", "2026-09-21", "dep-a"), "/planning/department?period=weekly&start=2026-09-21&departmentId=dep-a");
});

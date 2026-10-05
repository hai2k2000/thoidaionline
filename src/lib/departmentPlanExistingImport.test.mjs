import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");
const actions = read("../components/DepartmentPlanActions.tsx");
const importPreview = read("../components/DepartmentPlanImportPreview.tsx");
const importRoute = read("../app/api/planning/department/import/route.ts");
const confirmRoute = read("../app/api/planning/department/import/confirm/route.ts");
const repository = read("./departmentPlanRepository.ts");

test("existing Plan import targets current plan and keeps duplicate Plan guard separate", () => {
  assert.match(actions, /current_plan_id/);
  assert.match(actions, /import\/confirm/);
  assert.match(actions, /Kỳ này chưa có kế hoạch\./);
  assert.match(actions, /Kế hoạch kỳ này đã tồn tại\./);
  assert.match(importRoute, /current_plan_id/);
  assert.match(importRoute, /persisted: false/);
  assert.match(confirmRoute, /importItemsIntoPlan/);
  assert.match(repository, /already_in_plan/);
  assert.match(repository, /department_plan_items/);
});

test("existing Plan import uses the selected Plan dates as parser context", () => {
  assert.match(importRoute, /const requestedPeriodType/);
  assert.match(importRoute, /const periodStart = currentPlan\.data\.period_start/);
  assert.match(importRoute, /const periodEnd = currentPlan\.data\.period_end/);
});

test("Excel confirmation is the single final approval and unresolved rows remain unassigned", () => {
  assert.match(importPreview, /Xác nhận và import/);
  assert.match(actions, /mappingConfidence/);
  assert.match(importPreview, /Chưa phân công/);
  assert.match(actions, /collaboratorIds/);
  assert.match(importRoute, /employeeOptions/);
  assert.match(importRoute, /assignmentDifference/);
  assert.match(confirmRoute, /allowedIds/);
  assert.match(confirmRoute, /listActiveEmployees/);
  assert.match(repository, /createAndAssignItem/);
  assert.match(repository, /collaboratorIds/);
});

test("create flow still owns the existing-plan duplicate modal", () => {
  assert.match(actions, /if \(plan\) \{[\s\S]*openExisting\(plan\)/);
  assert.match(actions, /Kế hoạch kỳ này đã tồn tại\./);
  assert.match(actions, /Tạo kế hoạch kỳ mới/);
});

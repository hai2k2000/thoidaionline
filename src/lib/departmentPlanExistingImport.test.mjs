import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");
const actions = read("../components/DepartmentPlanActions.tsx");
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

test("create flow still owns the existing-plan duplicate modal", () => {
  assert.match(actions, /if \(plan\) \{[\s\S]*openExisting\(plan\)/);
  assert.match(actions, /Kế hoạch kỳ này đã tồn tại\./);
  assert.match(actions, /Tạo kế hoạch kỳ mới/);
});

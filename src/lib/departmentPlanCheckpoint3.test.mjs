import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("department plan page is read-only and never calls the creation RPC", () => {
  const source = read("../app/planning/department/page.tsx");
  assert.match(source, /getPeriod\(/);
  assert.match(source, /listPlanItems\(/);
  assert.doesNotMatch(source, /getOrCreatePlanForMutation|api_get_or_create_department_plan|method:\s*["']POST/);
});

test("department plan page canonicalizes URL state on the server", () => {
  const source = read("../app/planning/department/page.tsx");
  assert.match(source, /canonicalPeriodFromQuery/);
  assert.match(source, /redirect\(canonicalUrl\)/);
  assert.match(source, /resolveDepartmentPlanScope/);
  assert.doesNotMatch(source, /period_end|periodEnd.*searchParams/);
});

test("navigation stays in the approved weekly/monthly URL contract", () => {
  const source = read("departmentPlanNavigation.ts");
  assert.match(source, /period: periodType/);
  assert.match(source, /start: periodStart/);
  assert.match(source, /periodType === "weekly"/);
  assert.match(source, /periodType === "monthly"/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("explicit plan_id routes render stored historical dates without canonical rewrite", () => {
  const page = readFileSync(new URL("../app/planning/department/page.tsx", import.meta.url), "utf8");
  const reports = readFileSync(new URL("../app/planning/reports/page.tsx", import.meta.url), "utf8");
  for (const source of [page, reports]) {
    assert.match(source, /raw\.plan_id/);
    assert.match(source, /periodStart: historicalPlan\.period_start/);
    assert.match(source, /!historicalPlan &&/);
  }
});

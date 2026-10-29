import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("application conflict paths accept SQLSTATE 55000 alongside 40001", () => {
  assert.match(source("src/lib/departmentPlanHandlers.ts"), /error\?\.code === "40001" \|\| error\?\.code === "55000"/);
  assert.match(source("src/app/api/assets/status-requests/route.ts"), /error\.code === "40001" \|\| error\.code === "55000"/);
  assert.match(source("src/lib/databaseManagement/workflowErrors.mjs"), /code === "40001" \|\| code === "55000"/);
  assert.match(source("src/lib/workScheduleRepository.ts"), /error: \{ code: "40001", message: "workflow revision required" \}/);
  assert.match(source("src/app/api/tasks/duty/import/route.ts"), /rpcFailure\(saved\.error\)/);
});

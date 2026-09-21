import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Personal Plan API has a dedicated authenticated route and review action", () => {
  const route = read("../app/api/work-schedule/personal/route.ts");
  assert.match(route, /requireReadActor/);
  assert.match(route, /requireMutationActor/);
  assert.match(route, /listPersonal/);
  assert.match(route, /savePersonal/);
  assert.match(route, /reviewPersonal/);
  assert.match(route, /workflowRevision/);
  assert.match(route, /action.*approve|action.*reject/);
});

test("Personal Plan API validates local date/time and maps stale review conflicts", () => {
  const route = read("../app/api/work-schedule/personal/route.ts");
  assert.match(route, /validateLocalPlanInterval/);
  assert.match(route, /invalid_request/);
  assert.match(route, /rpcFailure/);
  assert.doesNotMatch(route, /reviewed_by/);
});

test("Personal Plan API never trusts client reviewer or scope fields", () => {
  const route = read("../app/api/work-schedule/personal/route.ts");
  assert.doesNotMatch(route, /body\.reviewedBy|body\.reviewerId|body\.approverId|body\.scheduleScope/);
  assert.match(route, /guard\.actor\.id/);
});

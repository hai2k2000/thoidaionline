import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/tasks/quick-report/route.ts", import.meta.url), "utf8");
const factory = readFileSync(new URL("./taskHandlerFactory.ts", import.meta.url), "utf8");
const repository = readFileSync(new URL("./taskRepository.ts", import.meta.url), "utf8");

test("quick report has a dedicated authenticated route and server-owned actor", () => {
  assert.match(route, /taskHandlers\.quickReport/);
  assert.match(factory, /quickReport/);
  assert.match(factory, /task\.quick_report\.create/);
  assert.doesNotMatch(route, /supabase|rpc\(/);
});

test("quick report repository calls only the hardened RPC", () => {
  assert.match(repository, /api_create_quick_report_v1/);
  assert.match(repository, /createQuickReportBatch/);
  assert.doesNotMatch(repository, /from\("tasks"\)\.insert/);
});

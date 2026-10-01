import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/tasks/quick-report/page.tsx", import.meta.url), "utf8");
const form = readFileSync(new URL("../components/QuickReportForm.tsx", import.meta.url), "utf8");
const tasks = readFileSync(new URL("../app/tasks/page.tsx", import.meta.url), "utf8");

test("quick report UI is permission-gated and offers both creation modes", () => {
  assert.match(page, /task\.quick_report\.create/);
  assert.match(form, /Một việc/);
  assert.match(form, /Nhiều việc/);
  assert.match(form, /\+ Thêm dòng/);
  assert.match(form, /crypto\.randomUUID/);
  assert.match(form, /Time24hInput/);
  assert.match(form, /rows\.length >= 50/);
});

test("Task Center only advertises the quick report action from server-provided permission", () => {
  assert.match(tasks, /canQuickReport/);
  assert.match(tasks, /task\.quick_report\.create/);
});

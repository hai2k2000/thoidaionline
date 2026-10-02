import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/tasks/quick-report/page.tsx", import.meta.url), "utf8");
const form = readFileSync(new URL("../components/QuickReportForm.tsx", import.meta.url), "utf8");
const tasks = readFileSync(new URL("../app/tasks/page.tsx", import.meta.url), "utf8");

test("quick report UI is permission-gated and uses one date-only unified form", () => {
  assert.match(page, /task\.quick_report\.create/);
  assert.doesNotMatch(form, /Một việc/);
  assert.doesNotMatch(form, /Nhiều việc/);
  assert.match(form, /\+ Thêm việc/);
  assert.match(form, /crypto\.randomUUID/);
  assert.doesNotMatch(form, /Time24hInput/);
  assert.match(form, /startDate/);
  assert.match(form, /completionDate/);
  assert.match(form, /Xóa/);
  assert.match(form, /rows\.length >= 50/);
});

test("Task Center only advertises the quick report action from server-provided permission", () => {
  assert.match(tasks, /canQuickReport/);
  assert.match(tasks, /task\.quick_report\.create/);
});

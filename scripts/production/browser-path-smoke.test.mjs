import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const smoke = readFileSync(new URL("./browser-path-smoke.mjs", import.meta.url), "utf8");
const page = readFileSync(new URL("../../src/app/tasks/page.tsx", import.meta.url), "utf8");

test("browser-path smoke covers the Server Component task-list URLs", () => {
  for (const path of [
    '"/tasks"',
    '"/tasks?journalism=exclude"',
    '"/tasks?journalism=only"',
    '"/tasks?journalism=exclude&approvalQueue=assignment"',
    '"/tasks?journalism=exclude&approvalQueue=completion"',
  ]) assert.match(smoke, new RegExp(path.replace(/[?&=]/g, "\\$&")));
  assert.match(smoke, /Không thể tải danh sách công việc/);
});

test("browser-path smoke uses the same server-rendered task page path", () => {
  assert.match(page, /parseTaskListSearchParams/);
  assert.match(page, /taskRepository\.list\(actor, query\)/);
  assert.doesNotMatch(smoke, /password|SUPABASE_SERVICE_ROLE_KEY/i);
});

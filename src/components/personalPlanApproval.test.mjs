import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Personal Plan UI uses the dedicated endpoint and required local times", () => {
  const shell = read("../components/WorkSchedulePageShell.tsx");
  assert.match(shell, /\/api\/work-schedule\/personal/);
  assert.match(shell, /name="startTime"[^>]*required=\{scheduleScope === "self" \|\| planType === "event"\}/);
  assert.match(shell, /name="endTime"[^>]*required=\{scheduleScope === "self" \|\| planType === "event"\}/);
  assert.match(shell, /workflowRevision/);
});

test("Personal Plan UI renders all approval states and review details", () => {
  const shell = read("../components/WorkSchedulePageShell.tsx");
  for (const label of ["Chờ phê duyệt", "Đã duyệt", "Từ chối", "Người duyệt", "Lý do từ chối"]) {
    assert.match(shell, new RegExp(label));
  }
  assert.match(shell, /PENDING_APPROVAL/);
  assert.match(shell, /REJECTED/);
});

test("Personal Plan UI hides review actions from the plan creator", () => {
  const shell = read("../components/WorkSchedulePageShell.tsx");
  assert.match(shell, /approvalRows\.filter\(\(row\) => row\.created_by !== approvalActorId\)/);
  assert.match(read("../app/work-schedule/page.tsx"), /approvalActorId=\{user\.id\}/);
  assert.match(read("../app/work-schedule/leadership/page.tsx"), /approvalActorId=\{user\.id\}/);
});

test("organization surfaces remain on the organization endpoint", () => {
  const admin = read("../components/WorkScheduleAdminShell.tsx");
  const summary = read("../components/WorkScheduleSummary.tsx");
  assert.match(admin, /\/api\/work-schedule/);
  assert.doesNotMatch(admin, /\/api\/work-schedule\/personal/);
  assert.match(summary, /\/api\/work-schedule/);
  assert.doesNotMatch(summary, /\/api\/work-schedule\/personal/);
  assert.match(read("../components/WorkSchedulePageShell.tsx"), /const personalMode = scheduleScope === "self"/);
});

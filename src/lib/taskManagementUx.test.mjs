import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { parseTaskListSearchParams, taskListHref } from "./taskFilters.mjs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("Etask UX status groups are separate from backward-compatible raw statuses", () => {
  for (const state of ["completed", "unfinished", "returned"]) {
    const parsed = parseTaskListSearchParams(new URLSearchParams({ state }));
    assert.equal(parsed.statusGroup, state);
    assert.equal(parsed.status, null);
    assert.match(taskListHref(parsed, {}), new RegExp(`state=${state}`));
  }
  const legacy = parseTaskListSearchParams(new URLSearchParams({ status: "rejected" }));
  assert.equal(legacy.status, "rejected");
  assert.equal(legacy.statusGroup, null);
});

test("Task Center has unified creation menu and requested Vietnamese filters", () => {
  const shell = read("../components/TaskCenterShell.tsx");
  assert.match(shell, /\+ Tạo công việc/);
  assert.match(shell, /\+ Tạo nhiệm vụ cá nhân/);
  assert.match(shell, /Công việc được giao/);
  assert.match(shell, /Nhiệm vụ cá nhân/);
  assert.match(shell, /name="state"/);
  for (const label of ["Đã hoàn thành", "Chưa hoàn thành", "Trả lại"]) {
    assert.match(shell, new RegExp(label));
  }
});

test("eligible legacy plans expose only the existing server-authorized claim route as Thực hiện", () => {
  const shell = read("../components/TaskCenterShell.tsx");
  const actions = read("../components/PersonalTaskActions.tsx");
  const page = read("../app/tasks/page.tsx");
  assert.match(shell, /canClaimTasks\s*&&\s*task\.self_claimable/);
  assert.match(page, /canClaimTasks=\{!\[['"]tong_bien_tap['"],\s*['"]tbt_read_only['"]\]\.includes\(user\.role_code\)\}/);
  assert.match(actions, /\/api\/tasks\/claim/);
  assert.match(actions, /Thực hiện/);
  assert.match(actions, /onClick=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.doesNotMatch(actions, /Tự nhận kế hoạch/);
});

test("task repository filters canonical and legacy task natures compatibly", () => {
  const repository = read("./taskRepository.ts");
  assert.match(repository, /task_type\.is\.null,plan_period\.in\.\(daily,weekly,monthly\)/);
  assert.match(repository, /task_type\.is\.null,plan_period\.eq\.ad_hoc,self_claimable\.eq\.false/);
});

test("progress workflow exposes explicit cancel and reschedule labels", () => {
  const detail = read("../components/TaskDetailShell.tsx");
  const page = read("../app/tasks/[id]/page.tsx");
  assert.match(detail, /Báo cáo tiến triển & vướng mắc/);
  assert.match(detail, /Hủy nhiệm vụ/);
  assert.match(detail, /Đổi ngày/);
  assert.match(page, /personalDeadline/);
});

test("personal tasks use explicit start and end dates without plan periods", () => {
  const form = read("../components/PersonalTaskForm.tsx");
  const navigation = read("../components/appNavState.ts");
  assert.match(form, /startDate/);
  assert.match(form, /dueDate/);
  assert.doesNotMatch(form, /planPeriod|daily|weekly|monthly/);
  assert.doesNotMatch(navigation, /label:\s*["']Kế hoạch["']/);
});

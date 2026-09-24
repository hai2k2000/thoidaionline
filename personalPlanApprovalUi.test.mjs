import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync("src/components/WorkSchedulePageShell.tsx", "utf8");
const staffPage = readFileSync("src/app/work-schedule/staff/page.tsx", "utf8");

test("personal plan staff page exposes approval capability only to approvers", () => {
  assert.match(staffPage, /is_department_manager/);
  assert.match(staffPage, /canReviewPersonalPlans/);
  assert.match(shell, /Chờ duyệt/);
  assert.match(shell, /Kế hoạch cá nhân/);
});

test("approval tab loads pending plans and shows the required review fields", () => {
  assert.match(shell, /scope=approval/);
  for (const label of ["Nhân sự", "Ngày", "Thời gian", "Nội dung", "Địa điểm", "Trạng thái"]) {
    assert.match(shell, new RegExp(label));
  }
  assert.match(shell, /Duyệt/);
  assert.match(shell, /Từ chối/);
});

test("approval actions reuse the existing personal plan PATCH endpoint and refresh state", () => {
  assert.match(shell, /fetch\("\/api\/work-schedule\/personal"/);
  assert.match(shell, /method: "PATCH"/);
  assert.match(shell, /setRetryToken/);
  assert.match(shell, /workflowRevision/);
});

test("approval UI does not create a second approval API or menu route", () => {
  assert.doesNotMatch(shell, /api\/personal-plan-approval/);
  assert.doesNotMatch(staffPage, /api\/personal-plan-approval/);
});

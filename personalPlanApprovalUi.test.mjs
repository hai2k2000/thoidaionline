import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync("src/components/WorkSchedulePageShell.tsx", "utf8");
const staffPage = readFileSync("src/app/work-schedule/staff/page.tsx", "utf8");

test("personal plan staff page exposes approval capability only to approvers", () => {
  assert.match(staffPage, /getApprovalCapabilities/);
  assert.match(staffPage, /canReviewAnyPersonalPlan/);
  assert.match(staffPage, /canReviewPersonalPlans/);
  assert.match(shell, /Chờ duyệt/);
  assert.match(shell, /Kế hoạch cá nhân/);
});

test("personal plan approval route delegates listing and authorization to the database", () => {
  const route = readFileSync("src/app/api/work-schedule/personal/route.ts", "utf8");
  const repository = readFileSync("src/lib/workScheduleRepository.ts", "utf8");
  assert.match(repository, /api_list_reviewable_personal_plans/);
  assert.match(route, /listReviewablePersonal\(guard\.actor\.id\)/);
  assert.match(route, /getApprovalCapabilities/);
  assert.match(route, /canReviewAnyPersonalPlan/);
  assert.match(route, /catch\s*\(error\)[\s\S]*rpcFailure\(error(?: as RpcError)?\)/);
  assert.doesNotMatch(route, /is_department_manager/);
  assert.doesNotMatch(route, /role_code\s*===\s*["'](?:admin|tong_bien_tap|pho_tong_bien_tap)["']/);
  assert.match(route, /reviewPersonal\(guard\.actor\.id/);
});

test("leave approval capability failures are mapped through rpcFailure", () => {
  const route = readFileSync("src/app/api/leave-requests/route.ts", "utf8");
  assert.match(route, /try\s*\{[\s\S]*getApprovalCapabilities\(guard\.actor\.id\)[\s\S]*\}\s*catch\s*\(error\)\s*\{[\s\S]*rpcFailure\(error(?: as RpcError)?\)/);
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

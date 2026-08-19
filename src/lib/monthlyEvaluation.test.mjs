import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260818123000_monthly_evaluation_auto_open.sql", "utf8");
const popupMigration = fs.readFileSync("supabase/migrations/20260818130000_personnel_task_popup.sql", "utf8");
const cycleHistoryMigration = fs.readFileSync("supabase/migrations/20260818133000_cycle_history_and_month_dedup.sql", "utf8");
const repository = fs.readFileSync("src/lib/evaluationRepository.ts", "utf8");
const handlers = fs.readFileSync("src/lib/evaluationHandlers.ts", "utf8");
const employeeShell = fs.readFileSync("src/components/EmployeeEvaluationShell.tsx", "utf8");
const personnelShell = fs.readFileSync("src/components/PersonnelEvaluationShell.tsx", "utf8");
const personnelDetailShell = fs.readFileSync("src/components/PersonnelEvaluationDetailShell.tsx", "utf8");
const rubricShell = fs.readFileSync("src/components/EvaluationRubricShell.tsx", "utf8");

test("monthly ensure snapshots rubric, routes manager/TBT and is idempotent", () => {
  assert.match(migration, /api_ensure_current_performance_cycle/);
  assert.match(migration, /timezone\('Asia\/Ho_Chi_Minh', now\(\)\)/);
  assert.match(migration, /on conflict \(code\) do update/i);
  assert.match(migration, /on conflict \(cycle_id,employee_id,revision_no\) do nothing/i);
  assert.match(migration, /then 'manager' else 'employee'/);
  assert.match(migration, /then 'awaiting_tbt' else 'awaiting_manager'/);
  assert.match(migration, /jsonb_agg\(jsonb_build_object/);
});

test("admin cycle history exposes aggregate review counts without N+1", () => {
  assert.match(cycleHistoryMigration, /api_list_performance_cycle_history/);
  assert.match(cycleHistoryMigration, /count\(pr\.id\) filter\(where pr\.status='awaiting_manager'\)/);
  assert.match(cycleHistoryMigration, /public\.phase7_is_admin\(p_actor\)/);
  assert.match(rubricShell, /Lịch sử kỳ đánh giá/);
  assert.match(rubricShell, /cycle\.rubric_versions/);
  assert.match(rubricShell, /cycle\.total_reviews/);
  assert.match(rubricShell, /type="month"/);
  assert.match(rubricShell, /cycleStatus/);
});

test("manual overlap is rejected and monthly ensure reuses a date-matching cycle", () => {
  assert.match(cycleHistoryMigration, /daterange\(pc\.start_date,pc\.end_date,'\[\]'\) && daterange\(p_start,p_end,'\[\]'\)/);
  assert.match(cycleHistoryMigration, /where start_date=v_month_start and end_date=v_month_end/);
  assert.match(cycleHistoryMigration, /close_duplicate_legacy/);
  assert.match(personnelDetailShell, /taskLimit < filteredTasks\.length/);
});

test("employee list loads another page when its own scroll reaches the bottom", () => {
  assert.match(personnelShell, /onScroll/);
  assert.match(personnelShell, /scrollTop.*clientHeight.*scrollHeight/);
  assert.match(personnelShell, /setVisibleLimit\(\(value\) => Math\.min\(value \+ 5, filteredSubjects\.length\)\)/);
});

test("personnel toolbar is compact on desktop and starts with five subjects", () => {
  assert.match(personnelShell, /useState\(5\)/);
  assert.match(personnelShell, /sm:flex-nowrap/);
  assert.match(personnelShell, /ĐÁNH GIÁ NHÂN SỰ/i);
  assert.match(personnelShell, /Nhân viên trực thuộc/);
});

test("personnel list explains non-overflow state and focuses after TBT expansion", () => {
  assert.match(personnelShell, /Đang hiển thị \$\{scopedSubjects\.length\} trưởng phòng/);
  assert.match(personnelShell, /Đánh giá thêm nhân viên \(\$\{data\.subjects\.length\}\)/);
  assert.match(personnelShell, /scrollRef\.current\?\.focus\(\)/);
  assert.match(personnelShell, /sticky bottom-0/);
  assert.match(personnelShell, /Xem thêm 5 nhân viên/);
});

test("personnel subjects support department, role and score-state AND filters", () => {
  assert.match(personnelShell, /departmentFilter/);
  assert.match(personnelShell, /roleFilter/);
  assert.match(personnelShell, /scoreFilter/);
  assert.match(personnelShell, /person\.departmentId === departmentFilter/);
  assert.match(personnelShell, /person\.isDepartmentManager/);
  assert.match(personnelShell, /finalScore|managerScore/);
  assert.match(personnelShell, /setVisibleLimit\(5\)/);
  assert.match(personnelShell, /overflow-x-auto/);
});

test("employee UI has no self-start or self-score while personnel UI uses snapshot factors", () => {
  assert.doesNotMatch(employeeShell, /Bắt đầu tự đánh giá/);
  assert.doesNotMatch(employeeShell, /action="self"/);
  assert.match(personnelDetailShell, /detail\.factors\.map/);
  assert.match(personnelDetailShell, /factor\.max_score/);
  assert.match(personnelDetailShell, /Chưa hoàn thành/);
  assert.match(personnelShell, /Đánh giá thêm/);
  assert.match(personnelShell, /slice\(0, visibleLimit\)/);
  assert.match(personnelDetailShell, /slice\(0, taskLimit\)/);
  assert.match(personnelDetailShell, /Người phụ trách/);
  assert.match(personnelDetailShell, /TaskDetailModal/);
  assert.match(personnelDetailShell, /event\.key === "Escape"/);
  assert.match(personnelDetailShell, /setSelectedTask\(task\)/);
});

test("personnel task popup fields stay inside the existing authorized detail RPC", () => {
  assert.match(popupMigration, /phase9_can_view_personnel_evaluation\(p_actor,p_employee\)/);
  for (const field of ["assignee_id", "assignee_name", "reviewer_id", "reviewer_name", "department_name", "description", "status"]) {
    assert.match(popupMigration, new RegExp(`'${field}'`));
  }
  assert.match(popupMigration, /task\.owner_id=p_employee/);
  assert.match(popupMigration, /ta\.user_id=p_employee/);
});

test("all evaluation/admin reads ensure the month and employee self-submit is blocked", () => {
  assert.equal((repository.match(/api_ensure_current_performance_cycle/g) ?? []).length, 4);
  assert.match(handlers, /return apiError\("forbidden", 403\)/);
  assert.match(migration, /self evaluation is disabled/);
});

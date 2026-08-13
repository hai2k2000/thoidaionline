import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

import * as evaluation from "./taskEvaluation.ts";

const {
  RATING_OPTIONS,
  WEIGHT_OPTIONS,
  canEditTaskEvaluation,
  normalizeEvaluationInput,
  selectLatestFinalEvaluations,
  summarizeEmployeeEvaluation,
  taskDetailUrl,
} = evaluation;

test("only editor-in-chief and existing administrators can edit task evaluations", () => {
  assert.equal(canEditTaskEvaluation({ roleCode: "tong_bien_tap", canManageUsers: false }), true);
  assert.equal(canEditTaskEvaluation({ roleCode: "tbt_read_only", canManageUsers: false }), true);
  assert.equal(canEditTaskEvaluation({ roleCode: "pho_tong_bien_tap", canManageUsers: true }), true);
  assert.equal(canEditTaskEvaluation({ roleCode: "admin", canManageUsers: true }), true);
  assert.equal(canEditTaskEvaluation({ roleCode: "pho_tong_bien_tap", canManageUsers: false }), false);
  assert.equal(canEditTaskEvaluation({ roleCode: "phu_trach_phong_tri_su", canManageUsers: false }), false);
  assert.equal(canEditTaskEvaluation({ roleCode: "phong_vien", canManageUsers: false }), false);
});

test("rating and effort options are explicit and bounded", () => {
  assert.deepEqual(RATING_OPTIONS, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(WEIGHT_OPTIONS, [1, 2, 3, 5, 8]);
});

test("normalization preserves opinion and ignores legacy score flags", () => {
  const normalized = normalizeEvaluationInput({
    rating: 9,
    effortWeight: 5,
    completion: "excellent",
    onTime: true,
    opinion: "Bài viết có nguồn dữ liệu tốt.",
    checkpointDate: "2026-08-13",
    isFinal: true,
    hardTask: true,
    improvement: true,
    contribution: true,
  });

  assert.equal(normalized.opinion, "Bài viết có nguồn dữ liệu tốt.");
  assert.equal("hardTask" in normalized, false);
  assert.equal("improvement" in normalized, false);
  assert.equal("contribution" in normalized, false);
});

test("weighted average compares task size fairly", () => {
  const summary = summarizeEmployeeEvaluation({
    tasks: [
      { id: "small", status: "done" },
      { id: "large", status: "done" },
    ],
    evaluations: [
      { id: "e1", task_id: "small", employee_id: "u1", rating: 10, effort_weight: 1, is_final: true, checkpoint_date: "2026-08-10", created_at: "2026-08-10T10:00:00Z" },
      { id: "e2", task_id: "large", employee_id: "u1", rating: 8, effort_weight: 8, is_final: true, checkpoint_date: "2026-08-11", created_at: "2026-08-11T10:00:00Z" },
    ],
    employeeId: "u1",
  });

  assert.equal(summary.taskCount, 2);
  assert.equal(summary.completedCount, 2);
  assert.equal(summary.notCompletedCount, 0);
  assert.equal(summary.totalWeight, 9);
  assert.equal(summary.weightedPoints, 74);
  assert.equal(summary.weightedAverage, 74 / 9);
});

test("only the latest final checkpoint per employee and task is aggregated", () => {
  const rows = [
    { id: "mid", task_id: "t1", employee_id: "u1", rating: 6, effort_weight: 3, is_final: false, checkpoint_date: "2026-08-01", created_at: "2026-08-01T10:00:00Z" },
    { id: "old-final", task_id: "t1", employee_id: "u1", rating: 7, effort_weight: 3, is_final: true, checkpoint_date: "2026-08-05", created_at: "2026-08-05T10:00:00Z" },
    { id: "new-final", task_id: "t1", employee_id: "u1", rating: 9, effort_weight: 5, is_final: true, checkpoint_date: "2026-08-12", created_at: "2026-08-12T10:00:00Z" },
  ];

  const selected = selectLatestFinalEvaluations(rows);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].id, "new-final");

  const summary = summarizeEmployeeEvaluation({ tasks: [{ id: "t1", status: "done" }], evaluations: rows, employeeId: "u1" });
  assert.equal(summary.totalWeight, 5);
  assert.equal(summary.weightedPoints, 45);
  assert.equal(summary.weightedAverage, 9);
});

test("employee modal task rows route to task detail", () => {
  assert.equal(taskDetailUrl("task-123"), "/tasks/task-123");
});

test("migration contract protects task evaluations", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20260813110000_task_evaluation_checkpoints.sql", import.meta.url), "utf8");
  assert.match(sql, /effort_weight[\s\S]*check[\s\S]*1[\s\S]*2[\s\S]*3[\s\S]*5[\s\S]*8/i);
  assert.match(sql, /rating[\s\S]*between 1 and 10/i);
  assert.match(sql, /task_evaluation_checkpoints/i);
  assert.match(sql, /save_task_evaluation_checkpoint/i);
  assert.match(sql, /tong_bien_tap[\s\S]*can_manage_users/i);
  assert.match(sql, /revoke[\s\S]*(insert|update|delete)[\s\S]*task_evaluation_checkpoints[\s\S]*anon/i);
  assert.match(sql, /grant execute[\s\S]*save_task_evaluation_checkpoint[\s\S]*anon/i);
});

test("forward migration grants TBT evaluation access without generic admin permissions", () => {
  const migrationUrl = new URL("../../supabase/migrations/20260813155000_allow_tbt_task_evaluation.sql", import.meta.url);
  assert.equal(existsSync(migrationUrl), true, "forward authorization migration must exist");
  const sql = existsSync(migrationUrl) ? readFileSync(migrationUrl, "utf8") : "";
  assert.match(sql, /r\.code\s+in\s*\(\s*'tong_bien_tap'\s*,\s*'tbt_read_only'\s*\)/i);
  assert.match(sql, /coalesce\(rp\.can_manage_users,\s*false\)\s*=\s*true/i);
  assert.doesNotMatch(sql, /update\s+public\.role_permissions/i);
});

test("task detail source hides mutations from employees and removes legacy controls", () => {
  const source = readFileSync(new URL("../app/tasks/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(source, /canEditEvaluation\s*\?/);
  assert.match(source, /Ý kiến đánh giá/);
  assert.match(source, /Lưu đánh giá/);
  assert.doesNotMatch(source, />\s*Việc khó\s*</);
  assert.doesNotMatch(source, />\s*Có cải tiến\s*</);
  assert.doesNotMatch(source, />\s*Có đóng góp\s*</);
});

test("employee summary source exposes modal task navigation", () => {
  const source = readFileSync(new URL("../app/performance/page.tsx", import.meta.url), "utf8");
  assert.match(source, /selectedEmployee/);
  assert.match(source, /taskDetailUrl\(row\.taskId\)/);
  assert.match(source, /router\.push/);
});

test("local checkpoint dates do not use UTC ISO truncation", () => {
  const source = readFileSync(new URL("../app/tasks/[id]/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
});

test("task detail selects final checkpoints instead of newer mid-period feedback", () => {
  const source = readFileSync(new URL("../app/tasks/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(source, /selectLatestFinalEvaluations\(rows\)/);
});

test("performance loads all tasks and checkpoints without silent fixed limits", () => {
  const source = readFileSync(new URL("../app/performance/page.tsx", import.meta.url), "utf8");
  assert.match(source, /fetchAllRows/);
  assert.doesNotMatch(source, /\.limit\((5000|20000)\)/);
});

test("migration prevents anonymous updates to task effort weight", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20260813110000_task_evaluation_checkpoints.sql", import.meta.url), "utf8");
  assert.match(sql, /protect_task_effort_weight/i);
  assert.match(sql, /current_user[\s\S]*anon/i);
});
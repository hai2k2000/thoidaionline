import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { parsePersonnelEvaluationFilters } from "./personnelEvaluationFilters.mjs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("personnel evaluation dates are validated and default to the current year", () => {
  assert.deepEqual(
    parsePersonnelEvaluationFilters({}, "2026-08-17"),
    { ok: true, from: "2026-01-01", to: "2026-12-31", employeeId: null },
  );
  assert.deepEqual(
    parsePersonnelEvaluationFilters(
      { from: "2026-02-01", to: "2026-02-28" },
      "2026-08-17",
    ),
    { ok: true, from: "2026-02-01", to: "2026-02-28", employeeId: null },
  );
  for (const filters of [
    { from: "2026-02-30", to: "2026-03-01" },
    { from: "2026-04-02", to: "2026-04-01" },
    { from: "2026-01-01", to: "2026-12-31", employee: "not-a-uuid" },
  ]) {
    assert.equal(parsePersonnelEvaluationFilters(filters, "2026-08-17").ok, false);
  }
});

test("dedicated personnel evaluation page and navigation are manager-or-leader only", () => {
  const page = read("../app/evaluations/page.tsx");
  const navigation = read("../components/phase2Navigation.ts");
  const session = read("./serverSession.ts");
  assert.match(page, /is_department_manager/);
  assert.match(page, /can_evaluate_step1/);
  assert.match(page, /tong_bien_tap/);
  assert.match(page, /can_evaluate_step2/);
  assert.match(navigation, /evaluations[^\n]*\/evaluations/);
  assert.match(session, /is_department_manager/);
  assert.doesNotMatch(page, /@\/lib\/supabase/);
});

test("personnel evaluation UI lists employees and drills into period tasks and rubric scores", () => {
  const shell = read("../components/PersonnelEvaluationShell.tsx");
  for (const label of [
    "Nhân viên trực thuộc",
    "Ngày bắt đầu",
    "Ngày kết thúc",
    "STT",
    "Tên công việc",
    "Độ khó",
    "Trạng thái hoàn thành",
    "Thời hạn",
    "Bảng chấm điểm cá nhân",
  ]) {
    assert.match(shell, new RegExp(label));
  }
  assert.match(shell, /employeeId/);
  assert.match(shell, /\/tasks\/\$\{task\.id\}/);
  assert.match(shell, /manager|Trưởng phòng/);
  assert.match(shell, /tbt|Tổng Biên tập/);
  assert.doesNotMatch(shell, /rating|\/10|Điểm từ 1 đến 10/i);
});

test("personnel evaluation reads are fail-closed, deterministic and service-role only", () => {
  const repository = read("./evaluationRepository.ts");
  const sql = read("../../supabase/migrations/20260817171500_personnel_evaluation_scope.sql");
  assert.match(repository, /api_list_personnel_evaluation_subjects/);
  assert.match(repository, /api_get_personnel_evaluation_detail/);
  assert.match(sql, /departments\.manager_id\s*=\s*p_actor/i);
  assert.match(sql, /r\.code\s*=\s*'tong_bien_tap'/i);
  assert.match(sql, /can_evaluate_step2/i);
  assert.match(sql, /p_from\s+is\s+null|p_to\s+is\s+null/i);
  assert.match(sql, /p_from\s*>\s*p_to/i);
  assert.match(sql, /is_department_manager\s+desc/i);
  assert.match(sql, /completion_submitted_at/i);
  assert.match(sql, /task_assignees/i);
  assert.match(sql, /revoke all[\s\S]*public,anon,authenticated/i);
  assert.match(sql, /grant execute[\s\S]*service_role/i);
  assert.doesNotMatch(sql, /task_evaluation_checkpoints|rating/i);
});

test("submitted personnel stages remain state-machine protected without invented overwrite APIs", () => {
  const handlers = read("./evaluationHandlers.ts");
  const phase7 = read("../../supabase/migrations/20260817090000_phase7_shared_rubric_evaluation.sql");
  assert.match(phase7, /invalid review state/);
  assert.match(phase7, /published performance reviews are immutable/);
  assert.doesNotMatch(handlers, /overwrite|revise|correction/i);
});

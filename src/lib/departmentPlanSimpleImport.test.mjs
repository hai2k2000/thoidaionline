import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildConfirmedImportItems,
  createDuplicateDecisions,
  summarizeImportCandidates,
} from "./departmentPlanImportPreview.mjs";

const actions = readFileSync(new URL("../components/DepartmentPlanActions.tsx", import.meta.url), "utf8");
const preview = readFileSync(new URL("../components/DepartmentPlanImportPreview.tsx", import.meta.url), "utf8");
const confirmRoute = readFileSync(new URL("../app/api/planning/department/import/confirm/route.ts", import.meta.url), "utf8");
const repository = readFileSync(new URL("./departmentPlanRepository.ts", import.meta.url), "utf8");

const candidate = (rowNumber, patch = {}) => ({
  rowNumber,
  title: `Công việc ${rowNumber}`,
  description: null,
  assigneeIds: [],
  collaboratorIds: [],
  dueDate: "2026-10-09",
  periodRelation: "IMPORTED",
  status: "planned",
  ...patch,
});

test("A: ten normal rows default to add without per-row decisions", () => {
  const rows = Array.from({ length: 10 }, (_, index) => candidate(index + 1));
  assert.deepEqual(createDuplicateDecisions(rows), {});
  assert.equal(buildConfirmedImportItems(rows, {}).length, 10);
  assert.doesNotMatch(preview, /aria-label={`Chọn \${item\.title}`}/);
  assert.doesNotMatch(preview, /Chọn dòng hợp lệ/);
});

test("B: exact assignee mappings are retained for assignment on final confirmation", () => {
  const rows = [candidate(1, { assigneeIds: ["person-a"], mappingConfidence: "HIGH" })];
  const [item] = buildConfirmedImportItems(rows, {});
  assert.deepEqual(item.assigneeIds, ["person-a"]);
  assert.equal(item.duplicateDecision, null);
});

test("C: unresolved assignees still import as unassigned Plan items", () => {
  const rows = [candidate(1, { assigneeNames: ["Lãnh đạo Phòng"], mappingConfidence: "UNRESOLVED", mappingBlocking: true })];
  const [item] = buildConfirmedImportItems(rows, {});
  assert.deepEqual(item.assigneeIds, []);
  assert.equal(item.periodGoal, "Công việc 1");
  assert.match(preview, /Chưa phân công/);
  assert.doesNotMatch(preview, /candidateBlocked/);
});

test("D: duplicate rows require merge, separate, or skip", () => {
  const rows = [candidate(1, { duplicateRequiresConfirmation: true, existingTask: { id: "task-a", title: "Công việc 1", confidence: "HIGH" } })];
  assert.throws(() => buildConfirmedImportItems(rows, {}), /duplicate decision required/);
  for (const decision of ["merge", "separate", "skip"]) {
    const result = buildConfirmedImportItems(rows, { "1:Công việc 1": decision });
    assert.equal(decision === "skip" ? result.length === 0 : result[0].duplicateDecision === decision, true);
  }
  assert.match(preview, /Gộp với công việc hiện có/);
  assert.match(preview, /Giữ là công việc riêng/);
  assert.match(preview, /Bỏ qua/);
});

test("E: reimport duplicates expose the merge/reuse path without silent merge", () => {
  const rows = [candidate(1, { duplicateRequiresConfirmation: true, alreadyInPlan: true, taskId: "task-a" })];
  const decisions = createDuplicateDecisions(rows);
  assert.deepEqual(decisions, { "task-a": null });
  assert.throws(() => buildConfirmedImportItems(rows, decisions), /duplicate decision required/);
  assert.match(confirmRoute, /duplicateDecision/);
  assert.match(repository, /duplicateDecision/);
});

test("F: thirteen-row preview is summarized and only conflicts need interaction", () => {
  const rows = Array.from({ length: 13 }, (_, index) => candidate(index + 1, index < 2 ? { duplicateRequiresConfirmation: true } : index === 2 ? { assigneeIds: ["person-a"], mappingConfidence: "HIGH" } : {}));
  assert.deepEqual(summarizeImportCandidates(rows, createDuplicateDecisions(rows)), {
    total: 13,
    newRows: 10,
    mappedRows: 1,
    duplicateRows: 2,
    unresolvedDuplicateRows: 2,
  });
  assert.match(preview, /XEM TRƯỚC IMPORT KẾ HOẠCH/);
  assert.match(preview, /Hiện chi tiết/);
  assert.match(preview, /Xác nhận và import/);
  assert.doesNotMatch(preview, /Mục tiêu kỳ cho/);
  assert.doesNotMatch(preview, /Trạng thái mapping/);
});
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const list = readFileSync("src/components/EvaluationCycleShell.tsx", "utf8");
const detail = readFileSync("src/components/EvaluationCycleDetailShell.tsx", "utf8");
const repo = readFileSync("src/lib/evaluationRepository.ts", "utf8");
test("cycle rows link to a full result detail page", () => { assert.match(list, /evaluation-cycles\/\$\{cycle\.id\}/); assert.match(detail, /Tổng hồ sơ/); assert.match(detail, /Trưởng phòng/); assert.match(detail, /TBT/); assert.match(detail, /Tổng điểm/); });
test("cycle detail loads review scores and rubric snapshots server-side", () => { assert.match(repo, /performance_review_scores/); assert.match(repo, /rubric_snapshot/); assert.match(repo, /cycleDetail/); });

test("cycle reviews follow shared staff ordering", () => { assert.match(repo, /sortStaffRows/); assert.match(repo, /list_order/); assert.match(repo, /staffOrder/); });

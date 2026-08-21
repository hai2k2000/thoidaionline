import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const nav = readFileSync("src/components/phase2Navigation.ts", "utf8");
const rubric = readFileSync("src/components/EvaluationRubricShell.tsx", "utf8");
const cycles = readFileSync("src/components/EvaluationCycleShell.tsx", "utf8");
test("rubric and cycle administration use separate routes", () => { assert.match(nav, /evaluation-cycles/); assert.doesNotMatch(rubric, /Quản trị kỳ đánh giá/); assert.match(cycles, /Quản trị kỳ đánh giá/); assert.match(cycles, /Mở kỳ tuần hiện tại/); });

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const migration = readFileSync("supabase/migrations/20260821140000_weekly_evaluation_cycles.sql", "utf8");
const shell = readFileSync("src/components/EvaluationRubricShell.tsx", "utf8");
const handlers = readFileSync("src/lib/evaluationHandlers.ts", "utf8");
test("weekly cycles use Monday-Sunday and Monday month", () => { assert.match(migration, /date_trunc\('week'/); assert.match(migration, /Tuần/); assert.match(migration, /cycle_type.*weekly/); });
test("cycle management exposes week and month actions", () => { assert.match(handlers, /open_week/); assert.match(handlers, /open_month/); assert.match(shell, /Mở kỳ tuần hiện tại/); assert.match(shell, /Mở kỳ tháng hiện tại/); assert.match(shell, /cycle\.cycle_type/); });

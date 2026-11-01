import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./TaskDetailShell.tsx", import.meta.url), "utf8");

test("evaluation results remain in overview instead of a separate tab", () => {
  assert.doesNotMatch(source, /id:\s*["']evaluation["']\s*,\s*label:/);
  assert.doesNotMatch(source, /task-panel-evaluation/);
  assert.match(source, /<section aria-label="Tổng quan"/);
  assert.match(source, /Kết quả chấm điểm/);
});

test("overview reading area stays in the main column without a nested scroll trap", () => {
  assert.match(source, /<section aria-label="Tổng quan" className="space-y-2\.5">/);
  assert.match(source, /whitespace-pre-wrap break-words/);
  assert.doesNotMatch(source, /task-overview-content[^\n]*overflow-y-auto/);
});

test("legacy evaluation tab state is removed from the single-page detail", () => {
  assert.doesNotMatch(source, /hash\s*===\s*["']evaluation["']|setActiveTab|getElementById\(["']task-evaluation-workspace/);
});

test("merged evaluation keeps review permission, scoring API and history", () => {
  assert.match(source, /capabilities\.review/);
  assert.match(source, /\/review-completion/);
  assert.match(source, /task\.completion_score/);
  assert.match(source, /task\.completion_score/);
});

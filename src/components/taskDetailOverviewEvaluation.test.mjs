import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./TaskDetailShell.tsx", import.meta.url), "utf8");

test("evaluation is part of overview instead of a separate tab", () => {
  assert.doesNotMatch(source, /id:\s*["']evaluation["']\s*,\s*label:/);
  assert.doesNotMatch(source, /task-panel-evaluation/);
  assert.match(source, /sm:grid-cols-4/);

  const readingWorkspace = source.indexOf('id="task-overview-content"');
  const evaluationWorkspace = source.indexOf('id="task-evaluation-workspace"');
  assert.ok(readingWorkspace >= 0, "overview reading workspace must exist");
  assert.ok(evaluationWorkspace > readingWorkspace, "evaluation must follow task content in overview");
});

test("overview reading area is bounded and can be expanded without a nested scroll trap", () => {
  assert.match(source, /contentExpanded/);
  assert.match(source, /max-h-\[42vh\]/);
  assert.match(source, /overflow-y-auto/);
  assert.match(source, /overscroll-contain/);
  assert.match(source, /aria-expanded=\{contentExpanded\}/);
  assert.match(source, /aria-controls="task-overview-content"/);
  assert.match(source, /Xem toàn bộ nội dung/);
  assert.match(source, /Thu gọn nội dung/);
});

test("legacy evaluation hash opens overview and focuses the merged workspace", () => {
  assert.match(source, /hash\s*===\s*["']evaluation["']/);
  assert.match(source, /setActiveTab\(["']overview["']\)/);
  assert.match(source, /getElementById\(["']task-evaluation-workspace["']\)/);
  assert.match(source, /scrollIntoView/);
  assert.match(source, /\.focus\(/);
  assert.match(source, /id="task-evaluation-workspace"[^>]*tabIndex=\{-1\}/);
});

test("merged evaluation keeps permissions, manual ChatGPT input, API and history", () => {
  assert.match(source, /capabilities\.evaluate/);
  assert.match(source, /\/evaluations/);
  assert.match(source, /Dán đánh giá từ ChatGPT/);
  assert.doesNotMatch(source, /Chưa cấu hình AI/);
  assert.match(source, /qualitative_evaluations/);
  assert.match(source, /legacy_evaluations/);
});

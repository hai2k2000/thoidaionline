import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("evaluation UI uses Vietnamese qualitative and deadline wording", () => {
  const taskSource = readFileSync(new URL("../components/TaskDetailShell.tsx", import.meta.url), "utf8");
  const performanceSource = readFileSync(new URL("../app/performance/page.tsx", import.meta.url), "utf8");
  const helperSource = readFileSync(new URL("./taskEvaluation.ts", import.meta.url), "utf8");
  const userFacingSource = [taskSource, performanceSource, helperSource].join("\n");

  assert.match(taskSource, /Mức độ đáp ứng yêu cầu/u);
  assert.match(taskSource, /Hạn:/u);
  assert.match(taskSource, /Chấm điểm hoàn thành/u);
  assert.match(taskSource, /Nhận xét/u);
  assert.doesNotMatch(userFacingSource, /Trọng số|trọng số|>[^<{]*checkpoint[^<{]*</iu);
});

test("legacy scores are hidden while qualitative evaluation is capability-gated", () => {
  const source = readFileSync(new URL("../components/TaskDetailShell.tsx", import.meta.url), "utf8");
  assert.match(source, /capabilities\.review/);
  assert.match(source, /task\.completion_score/);
  assert.match(source, /Lưu điểm và duyệt hoàn thành/);
  assert.doesNotMatch(source, /rating\}\/10|type="number"[^\n]*max=\{?10\}?/);
});

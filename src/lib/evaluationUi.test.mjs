import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("evaluation UI uses Vietnamese qualitative and deadline wording", () => {
  const taskSource = readFileSync(new URL("../components/TaskDetailShell.tsx", import.meta.url), "utf8");
  const performanceSource = readFileSync(new URL("../app/performance/page.tsx", import.meta.url), "utf8");
  const helperSource = readFileSync(new URL("./taskEvaluation.ts", import.meta.url), "utf8");
  const userFacingSource = [taskSource, performanceSource, helperSource].join("\n");

  assert.match(taskSource, /Mức độ khó/u);
  assert.match(taskSource, /Thời hạn đánh giá/u);
  assert.match(taskSource, /Đánh giá công việc/u);
  assert.match(taskSource, /Dán đánh giá từ ChatGPT/u);
  assert.doesNotMatch(userFacingSource, /Trọng số|trọng số|>[^<{]*checkpoint[^<{]*</iu);
});

test("legacy scores are hidden while qualitative evaluation is capability-gated", () => {
  const source = readFileSync(new URL("../components/TaskDetailShell.tsx", import.meta.url), "utf8");
  assert.match(source, /capabilities\.evaluate/);
  assert.match(source, /Dữ liệu lịch sử được giữ nguyên/);
  assert.match(source, /Lưu đánh giá/);
  assert.doesNotMatch(source, /rating\}\/10|Điểm[^\n]*1[^\n]*10/);
});

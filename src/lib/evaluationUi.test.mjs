import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("evaluation UI uses Vietnamese difficulty and evaluation-date wording", () => {
  const taskSource = readFileSync(new URL("../components/TaskDetailShell.tsx", import.meta.url), "utf8");
  const performanceSource = readFileSync(new URL("../app/performance/page.tsx", import.meta.url), "utf8");
  const helperSource = readFileSync(new URL("./taskEvaluation.ts", import.meta.url), "utf8");
  const userFacingSource = [taskSource, performanceSource, helperSource].join("\n");

  assert.match(taskSource, /M(?:\\u1ee9|\u1ee9)c (?:\\u0111|\u0111)(?:\\u1ed9|\u1ed9) kh(?:\\u00f3|\u00f3)/u);
  assert.match(taskSource, /Ng(?:\\u00e0|\u00e0)y (?:\\u0111|\u0111)(?:\\u00e1|\u00e1)nh gi(?:\\u00e1|\u00e1)/u);
  assert.match(userFacingSource, /(?:\\u0111|\u0111)(?:\\u00e1|\u00e1)nh gi(?:\\u00e1|\u00e1) gi(?:\\u1eefa|\u1eefa) k(?:\\u1ef3|\u1ef3)/iu);
  assert.match(userFacingSource, /(?:\\u0111|\u0111)(?:\\u00e1|\u00e1)nh gi(?:\\u00e1|\u00e1) cu(?:\\u1ed1i|\u1ed1i) k(?:\\u1ef3|\u1ef3)/iu);
  assert.doesNotMatch(userFacingSource, /Tr\u1ecdng s\u1ed1|tr\u1ecdng s\u1ed1|>[^<{]*checkpoint[^<{]*</iu);
});

test("legacy task evaluation is visibly read-only in Phase 5", () => {
  const source = readFileSync(new URL("../components/TaskDetailShell.tsx", import.meta.url), "utf8");
  assert.match(source, /Đánh giá cũ/);
  assert.match(source, /Dữ liệu cũ chỉ đọc/);
  assert.doesNotMatch(source, /Lưu đánh giá|saveEvaluation|evaluationOpen/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("evaluation UI uses Vietnamese difficulty and evaluation-date wording", () => {
  const taskSource = readFileSync(new URL("../app/tasks/[id]/page.tsx", import.meta.url), "utf8");
  const performanceSource = readFileSync(new URL("../app/performance/page.tsx", import.meta.url), "utf8");
  const helperSource = readFileSync(new URL("./taskEvaluation.ts", import.meta.url), "utf8");
  const userFacingSource = [taskSource, performanceSource, helperSource].join("\n");

  assert.match(taskSource, /M(?:\\u1ee9|\u1ee9)c (?:\\u0111|\u0111)(?:\\u1ed9|\u1ed9) kh(?:\\u00f3|\u00f3)/u);
  assert.match(taskSource, /Ng(?:\\u00e0|\u00e0)y (?:\\u0111|\u0111)(?:\\u00e1|\u00e1)nh gi(?:\\u00e1|\u00e1)/u);
  assert.match(userFacingSource, /(?:\\u0111|\u0111)(?:\\u00e1|\u00e1)nh gi(?:\\u00e1|\u00e1) gi(?:\\u1eefa|\u1eefa) k(?:\\u1ef3|\u1ef3)/iu);
  assert.match(userFacingSource, /(?:\\u0111|\u0111)(?:\\u00e1|\u00e1)nh gi(?:\\u00e1|\u00e1) cu(?:\\u1ed1i|\u1ed1i) k(?:\\u1ef3|\u1ef3)/iu);
  assert.doesNotMatch(userFacingSource, /Tr\u1ecdng s\u1ed1|tr\u1ecdng s\u1ed1|>[^<{]*checkpoint[^<{]*</iu);
});

test("task evaluation is an accessible accordion closed by default", () => {
  const source = readFileSync(new URL("../app/tasks/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const \[evaluationOpen, setEvaluationOpen\] = useState\(false\)/);
  assert.match(source, /aria-expanded=\{evaluationOpen\}/);
  assert.match(source, /aria-controls="task-evaluation-panel"/);
  assert.match(source, /id="task-evaluation-panel"/);
  assert.match(source, /onClick=\{\(\) => setEvaluationOpen\(\(open\) => !open\)\}/);
  assert.match(source, /if \(error\)[\s\S]*setEvaluationOpen\(true\)/);
  assert.match(source, /\{evaluationOpen \? \(/);
});

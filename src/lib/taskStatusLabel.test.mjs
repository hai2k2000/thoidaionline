import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const source = readFileSync("src/components/TaskCenterShell.tsx", "utf8");
test("task center keeps legacy and approval completion labels distinct", () => {
  assert.match(source, /status === "pending_review" \? \(approvalRequired \? "Chờ duyệt hoàn thành" : "Chờ chấm điểm"\)/);
});

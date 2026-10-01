import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync(new URL("./taskRepository.ts", import.meta.url), "utf8");
const center = readFileSync(new URL("../components/TaskCenterShell.tsx", import.meta.url), "utf8");

test("REPORT_ONLY stays visible in Task Center with a dedicated badge", () => {
  assert.match(repository, /workflow_type/);
  assert.match(center, /workflow_type === "REPORT_ONLY"/);
  assert.match(center, /Phát sinh/);
});

test("approval-specific queries explicitly exclude REPORT_ONLY", () => {
  assert.match(repository, /eq\("approval_required", true\)[\s\S]*neq\("workflow_type", "REPORT_ONLY"\)/);
});

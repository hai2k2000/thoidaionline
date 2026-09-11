import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/components/WorkSchedulePageShell.tsx", "utf8");
test("work schedule displays load errors and offers retry", () => {
  assert.match(source, /loadError/);
  assert.match(source, /Không tải được lịch công tác/);
  assert.match(source, /Thử lại/);
  assert.match(source, /setRetryToken/);
});

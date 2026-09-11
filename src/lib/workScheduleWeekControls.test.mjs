import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/components/WorkSchedulePageShell.tsx", "utf8");
test("work schedule week selector updates the displayed anchor", () => {
  assert.match(source, /const nextWeek = Number\(event\.target\.value\)/);
  assert.match(source, /setAnchor\(iso\(weeks\[nextWeek\]\.start\)\)/);
});

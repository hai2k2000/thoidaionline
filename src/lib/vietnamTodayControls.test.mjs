import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const files = ["src/components/DutyScheduleViewer.tsx", "src/components/OnlineWorkViewer.tsx"];
test("schedule today controls use Vietnam calendar date", () => {
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /timeZone: "Asia\/Ho_Chi_Minh"/);
    assert.match(source, /const vietnamToday = \(\) => new Intl\.DateTimeFormat/);
    assert.match(source, /setAnchor\(vietnamToday\(\)\)/);
  }
});

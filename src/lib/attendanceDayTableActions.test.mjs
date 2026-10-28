import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/attendance/page.tsx", import.meta.url), "utf8");

// Owner feedback 2026-10-28: the day table shows only the note action, as a pen icon.
test("day table has no workday-adjustment button and a pen-icon note button", () => {
  assert.doesNotMatch(page, /Điều chỉnh công<\/button>/);
  assert.match(page, /title=\{r\.admin_note \? "Sửa ghi chú Admin" : "Thêm ghi chú Admin"\}/);
  assert.match(page, /M16\.5 3\.5a2\.12 2\.12 0 0 1 3 3L8 18l-4 1-1-4Z" \/><\/svg><\/button>/);
  assert.doesNotMatch(page, /M12 5v14M5 12h14/);
  assert.match(page, /attendance-note-action/);
});

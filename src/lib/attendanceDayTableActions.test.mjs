import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/attendance/page.tsx", import.meta.url), "utf8");

// Owner feedback 2026-10-28: the day table shows only the note action, labelled.
test("day table has no workday-adjustment button and a labelled note button", () => {
  assert.doesNotMatch(page, /Điều chỉnh công<\/button>/);
  assert.match(page, /"Sửa ghi chú" : "Thêm ghi chú"/);
  assert.match(page, /attendance-note-action/);
});

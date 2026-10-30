import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/attendance/page.tsx", import.meta.url), "utf8");

// Owner feedback 2026-10-28: the day table shows only the note action, as a pen icon.
test("day table has no workday-adjustment button and a pen-icon note button", () => {
  assert.doesNotMatch(page, /Điều chỉnh công<\/button>/);
  assert.match(page, /Ghi chú Admin/);
  assert.match(page, /selectedAttendanceRow/);
  assert.doesNotMatch(page, /M12 5v14M5 12h14/);
  assert.doesNotMatch(page, /attendance-note-action/);
});

// Owner report 2026-10-30: admin notes vanished from the list after the popup refactor.
test("list note cell shows the admin note under the system note", () => {
  assert.match(page, /attendance-note-cell[\s\S]{0,300}\{r\.admin_note \? <div className="attendance-admin-note[^"]*"><strong>Ghi chú Admin:<\/strong> \{r\.admin_note\}<\/div> : null\}/);
});

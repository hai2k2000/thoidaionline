import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const source = readFileSync(new URL("../components/JournalismCalendarShell.tsx", import.meta.url), "utf8");
test("calendar UI exposes views, required filters and status highlights", () => {
  for (const token of ["Ngày", "Tuần", "Tháng", "reporter", "status", "topic", "series", "journalismCalendarStatusLabels", "journalismPublicationStatusLabel"]) assert.match(source, new RegExp(token));
});
test("calendar UI uses a simple planned-date form without drag/drop or CMS integration", () => {
  assert.match(source, /datetime-local/);
  assert.match(source, /plannedPublicationAt/);
  assert.doesNotMatch(source, /draggable|onDrag|MasterCMS|webhook|polling/);
});

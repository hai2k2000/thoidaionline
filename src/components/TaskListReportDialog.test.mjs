import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("report download shows the selected count and disables an empty or stale selection", () => {
  const file = new URL("./TaskListReportDialog.tsx", import.meta.url);
  assert.ok(existsSync(file), "The report picker dialog must exist");
  const source = readFileSync(file, "utf8");
  assert.match(source, /Tải DOCX \(\{selectedCount\} việc\)/);
  assert.match(source, /disabled=\{[^}]*selectedCount === 0[^}]*stale/);
  assert.match(source, /selectTaskListReportModel\(model, selectedIds\)/);
  assert.match(source, /method: "POST"/);
  assert.match(source, /mobile-dialog-overlay/);
});

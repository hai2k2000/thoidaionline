import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (name) => fs.readFileSync(new URL(name, import.meta.url), "utf8");

test("save popups show success before closing and keep errors open", () => {
  const eventPanel = read("./EventAssignmentPanel.tsx");
  const metadata = read("./JournalismMetadataEditor.tsx");
  const publication = read("./JournalismPublicationControls.tsx");
  const manual = read("./JournalismManualPublicationReport.tsx");

  assert.match(eventPanel, /setTimeout\(\(\) => \{[\s\S]*setOpen\(false\)[\s\S]*\}, 500\)/);
  for (const source of [metadata, publication, manual]) {
    assert.match(source, /setTimeout\(\(\) => \{[\s\S]*close\(\)[\s\S]*\}, 500\)/);
    assert.match(source, /Đã lưu|success/);
  }
  assert.match(eventPanel, /disabled=\{busy \|\| saved\}/);
  assert.match(metadata, /disabled=\{busy \|\| saved\}/);
  assert.match(publication, /disabled=\{busy \|\| saved\}/);
  assert.match(manual, /disabled=\{busy \|\| saved\}/);
  assert.match(metadata, /setErrors\(\{ form: message \}\)/);
  assert.match(publication, /setError\(mapped\.message\)/);
  assert.match(manual, /setError\(mapped\.message\)/);
});

test("department plan save reports success before closing", () => {
  const source = read("./DepartmentPlanItemDialog.tsx");
  assert.match(source, /saved \? "Đã lưu"/);
  assert.match(source, /setTimeout\(\(\) => \{ setSaved\(false\); onClose\(\); \}, 500\)/);
  assert.match(source, /disabled=\{saving \|\| saved/);
});

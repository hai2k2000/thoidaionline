import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (name) => fs.readFileSync(new URL(name, import.meta.url), "utf8");

test("print model exposes a safe Vietnamese PDF title and readable department label", () => {
  const model = read("./taskPrintModel.ts");
  assert.match(model, /export function sanitizePrintFilenameTitle/);
  assert.match(model, /replace\(\/\[<>:/);
  assert.match(model, /slice\(0, 180\)/);
  assert.match(model, /departments\?\.name/);
  assert.doesNotMatch(model, /department.*code.*display/i);
});

test("print sheet follows the approved numbered section design", () => {
  const sheet = read("../components/WorkAssignmentPrintSheet.tsx");
  const css = read("../app/globals.css");
  assert.match(sheet, /data-section="assignment"/);
  assert.match(sheet, /data-section="content"/);
  assert.match(sheet, /data-section="confirmation"/);
  assert.match(sheet, /section-number/);
  assert.match(sheet, /calendar|user|group/i);
  assert.match(css, /print-section-frame/);
  assert.match(css, /print-section-heading/);
  assert.match(css, /signature-panel/);
});

test("print page sets the task title without changing the visible task title", () => {
  const sheet = read("../components/WorkAssignmentPrintSheet.tsx");
  const actions = read("../components/PrintActions.tsx");
  assert.match(sheet, /documentTitle=\{model\.title\}/);
  assert.match(actions, /sanitizePrintFilenameTitle/);
  assert.match(sheet, /model\.title/);
});

test("print sheet uses a compact two-row assignment info layout", () => {
  const sheet = read("../components/WorkAssignmentPrintSheet.tsx");
  const css = read("../app/globals.css");
  assert.match(sheet, /print-info-dates/);
  assert.match(sheet, /print-info-people/);
  assert.match(sheet, /print-header-compact/);
  assert.match(css, /\.print-info-dates\s*\{[\s\S]*grid-template-columns:\s*repeat\(2/);
  assert.match(css, /\.print-info-people\s*\{[\s\S]*grid-template-columns:\s*repeat\(3/);
  assert.match(css, /\.print-header-compact/);
});

test("print CSS prioritizes content and keeps signatures compact", () => {
  const css = read("../app/globals.css");
  assert.match(css, /\.print-content-grid[\s\S]*break-inside:\s*avoid/);
  assert.match(css, /\.signature-grid\s*\{[\s\S]*margin-top:\s*4mm/);
  assert.doesNotMatch(css, /\.signature-grid\s*\{\s*margin-top:\s*14mm/);
  assert.match(css, /@media print[\s\S]*\.print-box[\s\S]*padding:\s*0\.35rem/);
  assert.doesNotMatch(css, /min-height:\s*18mm/);
});

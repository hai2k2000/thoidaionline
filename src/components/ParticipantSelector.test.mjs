import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { calculateParticipantPanelPosition } from "./participantPanelPosition.mjs";

test("participant panel positions below and constrains height", () => {
  const result = calculateParticipantPanelPosition({ left: 40, top: 100, bottom: 140, width: 260, height: 40 }, { viewportWidth: 1024, viewportHeight: 800 });
  assert.deepEqual(result, { left: 40, top: 144, width: 280, maxHeight: 320, above: false });
});

test("participant panel flips above when space below is insufficient", () => {
  const result = calculateParticipantPanelPosition({ left: 40, top: 700, bottom: 740, width: 260, height: 40 }, { viewportWidth: 1024, viewportHeight: 800 });
  assert.equal(result.top, 696);
  assert.equal(result.above, true);
  assert.equal(result.maxHeight, 320);
});

test("participant panel uses trigger width on mobile and available height", () => {
  const result = calculateParticipantPanelPosition({ left: 12, top: 500, bottom: 540, width: 320, height: 40 }, { viewportWidth: 390, viewportHeight: 600 });
  assert.deepEqual(result, { left: 12, top: 496, width: 320, maxHeight: 360, above: true });
});

test("short viewport caps height and oversized triggers cannot overflow horizontally", () => {
  const result = calculateParticipantPanelPosition({ left: -20, top: 120, bottom: 160, width: 500 }, { viewportWidth: 320, viewportHeight: 280 });
  assert.equal(result.left, 8);
  assert.equal(result.width, 304);
  assert.equal(result.maxHeight, 108);
});

test("portal stays out of flow and handles both inside targets, focus and scroll", () => {
  const source = readFileSync(new URL('./ParticipantSelector.tsx', import.meta.url), 'utf8');
  for (const pattern of [/createPortal\(/, /document\.body/, /position: "fixed"/, /self-start/, /z-50/, /panelRef\.current\?\.contains/, /rootRef\.current\?\.contains/, /"scroll", updatePosition, true/, /triggerRef\.current\?\.focus/, /aria-controls=/, /role="listbox"/, /sticky top-0/, /form=\{formId\} name=\{name\}/]) assert.match(source, pattern);
  for (const file of ['CanonicalAssignmentForm.tsx', 'TaskAssignShell.tsx']) {
    const form = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(form, /import ParticipantSelector/);
    assert.match(form, /grid items-start gap-3 lg:grid-cols-2/);
    assert.doesNotMatch(form, /function ParticipantSelector/);
  }
});

test("participant panel is never narrower than 280px for compact triggers", () => {
  const result = calculateParticipantPanelPosition({ left: 600, top: 40, bottom: 80, width: 64, height: 40 }, { viewportWidth: 1280, viewportHeight: 800 });
  assert.equal(result.width, 280);
  const narrow = calculateParticipantPanelPosition({ left: 10, top: 40, bottom: 80, width: 64, height: 40 }, { viewportWidth: 240, viewportHeight: 800 });
  assert.equal(narrow.width, 224);
});

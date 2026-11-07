import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "../..");
const read = (file) => readFileSync(join(root, file), "utf8");
const files = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name);
  return entry.isDirectory() ? files(path) : entry.name.endsWith(".tsx") ? [path] : [];
});

test("native confirmation calls are replaced", () => {
  const violations = files("src").filter((file) => !file.endsWith("ProjectStatusControl.tsx") && /window\.(confirm|alert)|(?<!window\.)\bconfirm\s*\(/s.test(read(file)));
  assert.deepEqual(violations, []);
});

test("dialog exposes accessible safeguards", () => {
  const source = read("src/components/ConfirmDialog.tsx");
  for (const token of ['role="alertdialog"', 'aria-modal="true"', 'aria-labelledby', 'aria-describedby', 'cancelRef.current?.focus()', 'event.key === "Escape"', 'requireAcknowledge', 'disabled={Boolean(pending.options.requireAcknowledge) && !acknowledged}']) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(read("src/app/layout.tsx"), /<ConfirmDialogProvider>/);
});

test("prompt dialog supports required confirmation and cancellation", () => {
  const source = read("src/components/ConfirmDialog.tsx");
  assert.match(source, /usePromptDialog/);
  assert.match(source, /disabled=\{Boolean\(promptPending\.options\.required\) && !promptValue\.trim\(\)\}/);
  assert.match(source, /finishPrompt\(null\)/);
});

test("native prompt calls are replaced", () => {
  const violations = files("src").filter((file) => !file.endsWith("ConfirmDialog.test.mjs") && /window\.prompt\s*\(/s.test(read(file)));
  assert.deepEqual(violations, []);
});

test("work schedule nav row is responsive", () => {
  assert.match(read("src/components/WorkSchedulePageShell.tsx"), /flex-col/);
  assert.match(read("src/components/WorkSchedulePageShell.tsx"), /lg:flex-row/);
});

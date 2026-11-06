import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "../../..");
const read = (file) => readFileSync(join(root, file), "utf8");
const screens = [
  "src/components/WorkSchedulePageShell.tsx",
  "src/app/attendance/page.tsx",
  "src/components/attendance/AttendanceMonthGrid.tsx",
  "src/app/database/records/page.tsx",
  "src/app/users/page.tsx",
  "src/components/TaskStatusTablePage.tsx",
  "src/components/ProjectDetailShell.tsx",
];

test("mobile card screens use the shared list and responsive table pairing", () => {
  for (const file of screens) {
    const source = read(file);
    assert.match(source, /MobileCardList/ , `${file} must use MobileCardList`);
    if (source.includes("<table")) assert.match(source, /hidden[^"`]*md:block|md:block[^"`]*hidden/, `${file} desktop tables must be hidden below md`);
    assert.ok(source.includes("md:hidden") || read("src/components/mobile/MobileCardList.tsx").includes("md:hidden"), `${file} must include a mobile card/list branch`);
  }
});

test("shared card links are separate from footer actions and badge tones are token-backed", () => {
  const source = read("src/components/mobile/MobileCardList.tsx");
  assert.doesNotMatch(source, /<Link[\s\S]*<button/);
  for (const token of ["bg-surface-muted", "bg-success-soft", "bg-warning-soft", "bg-danger-soft", "bg-info-soft", "bg-brand"]) assert.match(source, new RegExp(token));
  assert.deepEqual([...source.matchAll(/(neutral|success|warning|danger|info|brand):/g)].map((m) => m[1]), ["neutral", "success", "warning", "danger", "info", "brand"]);
});

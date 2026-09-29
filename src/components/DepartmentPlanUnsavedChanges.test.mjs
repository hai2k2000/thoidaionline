import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (name) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

test("dirty detail state does not silently discard edits", () => {
  const source = read("DepartmentPlanItemDialog.tsx");
  assert.match(source, /const dirty = useMemo/);
  assert.match(source, /if \(!dirty \|\| window\.confirm/);
  assert.match(source, /if \(dirty && !window\.confirm/);
});

test("outside-period due date remains a warning", () => {
  const source = read("DepartmentPlanItemDialog.tsx");
  assert.match(source, /Hạn hoàn thành nằm ngoài kỳ kế hoạch/);
  assert.match(source, /outsidePeriod\(draft\.dueAt, period\)/);
  assert.doesNotMatch(source, /outsidePeriod\(draft\.dueAt, period\).*setError/);
});

test("audit fields are rendered read-only", () => {
  const source = read("DepartmentPlanItemDialog.tsx");
  assert.match(source, /item\.created_by_name/);
  assert.match(source, /item\.created_at/);
  assert.match(source, /item\.updated_at/);
  assert.doesNotMatch(source, /created_at[^}]*onChange/);
});

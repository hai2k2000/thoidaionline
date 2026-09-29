import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./departmentPlanNavigation.ts", import.meta.url), "utf8");

test("navigation canonicalizes weekly and monthly query starts", () => {
  assert.match(source, /getDepartmentPlanPeriod\(periodType, requestedStart, now\)/);
  assert.match(source, /return getDepartmentPlanPeriod\(periodType, null, now\)/);
});

test("navigation handles timezone defaults near UTC midnight", () => {
  assert.match(source, /canonicalPeriodFromQuery/);
  assert.match(readFileSync(new URL("./departmentPlanPeriod.ts", import.meta.url), "utf8"), /Asia\/Ho_Chi_Minh/);
});

test("navigation shifts calendar boundaries without UTC drift", () => {
  assert.match(source, /date\.setUTCDate\(date\.getUTCDate\(\) \+ amount \* 7\)/);
  assert.match(source, /date\.setUTCMonth\(date\.getUTCMonth\(\) \+ amount\)/);
});

test("period labels and URLs are canonical and shareable", () => {
  assert.match(source, /period: periodType/);
  assert.match(source, /start: periodStart/);
  assert.match(source, /Tháng \$\{month\}\/\$\{year\}/);
  assert.match(source, /formatter\.format/);
});

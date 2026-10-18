import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../../app/database/records/new/page.tsx", import.meta.url), "utf8");

test("dynamic record form renders typed controls instead of one universal text input", () => {
  for (const type of ["long_text", "select", "country", "department", "multi_select", "date", "datetime", "number", "url"]) assert.match(page, new RegExp(`data_type === \"${type}\"`));
  assert.match(page, /selectedOptions/);
  assert.match(page, /type=\{inputType\}/);
});

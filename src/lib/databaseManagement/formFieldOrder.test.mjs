import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { sortFormFields } from "./formFieldOrder.mjs";

test("sorts form fields numerically, keeps null orders last, and does not mutate input", () => {
  const fields = [
    { field_key: "zeta", sort_order: null },
    { field_key: "hundred", sort_order: 100 },
    { field_key: "ten", sort_order: 10 },
    { field_key: "alpha", sort_order: null },
    { field_key: "thirty", sort_order: 30 },
    { field_key: "seven-hundred", sort_order: 700 },
    { field_key: "one-thousand-ninety", sort_order: 1090 },
  ];
  const original = [...fields];

  assert.deepEqual(sortFormFields(fields).map((field) => field.sort_order), [10, 30, 100, 700, 1090, null, null]);
  assert.deepEqual(sortFormFields([{ field_key: "b", sort_order: 10 }, { field_key: "a", sort_order: 10 }]).map((field) => field.field_key), ["a", "b"]);
  assert.deepEqual(fields, original);
  assert.deepEqual(sortFormFields(null), []);
  assert.deepEqual(sortFormFields(undefined), []);
});

test("catalog route uses the shared form field sorter", () => {
  const route = readFileSync(fileURLToPath(new URL("../../app/api/database/catalog/route.ts", import.meta.url)), "utf8");
  assert.match(route, /import \{ sortFormFields \} from "@\/lib\/databaseManagement\/formFieldOrder\.mjs"/);
  assert.match(route, /db_form_fields: sortFormFields\(form\.db_form_fields\)\.map/);
});

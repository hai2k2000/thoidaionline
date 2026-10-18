import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const route = readFileSync(fileURLToPath(new URL("../../app/api/database/catalog/route.ts", import.meta.url)), "utf8");

test("catalog API is authenticated, permission checked and no-store", () => {
  assert.match(route, /getSessionUser/);
  assert.match(route, /record\.discover/);
  assert.match(route, /db_categories/);
  assert.match(route, /db_form_fields/);
  assert.match(route, /private, no-store/);
});

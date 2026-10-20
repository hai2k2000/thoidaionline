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

test("catalog API preserves parent categories needed by the language group selector", () => {
  assert.match(route, /select\("id,parent_id,code,name,department_id,active,sort_order"\)/);
  assert.match(route, /category\.parent_id/);
  assert.match(route, /visibleCategoryIds\.add\(category\.parent_id\)/);
});

test("record create route preserves dynamic metadata validation fields", () => {
  const createRoute = readFileSync(fileURLToPath(new URL("../../app/api/database/records/route.ts", import.meta.url)), "utf8");
  assert.match(createRoute, /invalid_metadata/);
  assert.match(createRoute, /JSON\.parse\(error\.message\.slice/);
  assert.match(createRoute, /fields,?\s*\}, 400/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const catalog = readFileSync(new URL("../supabase/migrations/20261017101000_database_management_v1_catalog.sql", import.meta.url), "utf8");
const matrix = readFileSync(new URL("../docs/CP2_DATABASE_MANAGEMENT_V1_MATRIX.md", import.meta.url), "utf8");

test("CP2 matrix covers the 44 catalog types without inventing fields", () => {
  const typeRows = catalog.match(/\('(?:tong_hop|truyen_thong|noi_dung_tieng_viet|ngoai_ngu|doan_the_quan_ly)','[^']+'/g) ?? [];
  assert.equal(typeRows.length, 44);
  assert.equal((matrix.match(/^\|\s*\d+\s*\|/gm) ?? []).length, 44);
  assert.match(matrix, /Specialized metadata/);
  assert.match(matrix, /Owner confirmation/);
});

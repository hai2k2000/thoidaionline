import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../../supabase/migrations/20261110100000_database_management_v1_status_field_options.sql", import.meta.url), "utf8");

test("status option repair restores workflow values and asserts them", () => {
  for (const value of ["draft", "pending_review", "approved", "archived"]) assert.match(sql, new RegExp(`"value":"${value}"`));
  assert.match(sql, /field_key = 'status'/);
  assert.match(sql, /raise exception/);
  assert.doesNotMatch(sql, /\bdelete\b/i);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const migration = readFileSync(fileURLToPath(new URL("../../../supabase/migrations/20261017100000_database_management_v1_foundation.sql", import.meta.url)), "utf8");
const catalog = readFileSync(fileURLToPath(new URL("../../../supabase/migrations/20261017101000_database_management_v1_catalog.sql", import.meta.url)), "utf8");

test("foundation migration is additive, indexed, server-only and ACL-capable", () => {
  for (const table of ["db_categories", "db_record_types", "db_form_definitions", "db_form_fields", "db_records", "db_record_files", "db_record_external_links", "db_record_acl", "db_record_history", "db_saved_search_filters"]) assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
  assert.match(migration, /record\.download/);
  assert.match(migration, /revoke all on table public\.%I from public, anon, authenticated/);
  assert.match(migration, /using gin\(search_document\)/);
  assert.match(migration, /create trigger db_records_search_document_trigger/);
  assert.doesNotMatch(migration, /grant .* to anon|grant .* to authenticated/i);
});

test("catalog migration does not invent a thirteenth top-level group", () => {
  assert.equal((catalog.match(/values\n\s*\('tong_hop'/)?.length ?? 0), 1);
  assert.match(catalog, /'doan_the_quan_ly'/);
  assert.match(catalog, /db_form_definitions/);
  assert.match(catalog, /db_form_fields/);
});

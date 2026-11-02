import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261103140000_database_management_v1_keywords_fix_remaining.sql", "utf8");
const revert = readFileSync("scripts/production/database-management-keywords-fix-remaining-revert.sql", "utf8");

test("keywords migration versions all ten active types and preserves source form settings", () => {
  for (const code of ["chi_hoi_nha_bao", "doan_thanh_nien", "cuc_bao_chi"]) assert.ok(migration.includes("'" + code + "'"));
  assert.match(migration, /coalesce\(max\(version\),\s*0\)\s*\+\s*1/);
  assert.match(migration, /source_form\.search_config, source_form\.display_config/);
  for (const column of ["field_key", "label", "data_type", "required", "searchable", "options", "validation", "hidden", "sort_order"]) {
    assert.ok(migration.includes("source_field." + column), "must copy " + column + " unchanged before targeted updates");
  }
  assert.match(migration, /if source_form\.id is null then\s+raise exception/);
  assert.match(migration, /processed_count <> 10/);
  assert.doesNotMatch(migration, /updated_at/);
});

test("keywords migration explicitly lists columns for every field insert", () => {
  const inserts = [...migration.matchAll(/insert into public\.db_form_fields\b/gi)];
  assert.ok(inserts.length > 0);
  for (const insert of inserts) {
    assert.match(migration.slice(insert.index + insert[0].length), /^\s*\(\s*form_definition_id,\s*field_key,/);
  }
});

test("keywords migration asserts per-type form counts, field state and global empty multi-select protection", () => {
  assert.match(migration, /\$assert\$/);
  assert.match(migration, /set data_type = 'text', options = '\[\]'::jsonb, validation = '\{"maxLength":500\}'::jsonb/);
  assert.match(migration, /set hidden = true, required = false/);
  assert.match(migration, /set hidden = false, required = false/);
  assert.match(migration, /having count\(published_form\.id\) <> 1/);
  assert.match(migration, /field_key = 'title' and form_field\.required/);
  assert.match(migration, /field_key <> 'title' and form_field\.required/);
  assert.match(migration, /record_type\.active[\s\S]*not form_field\.hidden[\s\S]*data_type = 'multi_select'[\s\S]*options = '\[\]'::jsonb/);
  assert.match(migration, /notify pgrst, 'reload schema';/);
});

test("revert restores the greatest version below the current published form for each target", () => {
  assert.match(revert, /20261103140000_database_management_v1_keywords_fix_remaining\.sql/);
  assert.match(revert, /candidate_form\.version < current_form\.version/);
  assert.match(revert, /order by candidate_form\.version desc\s+limit 1/);
  assert.match(revert, /having count\(published_form\.id\) <> 1/);
  assert.match(revert, /previous_form_id is null then\s+raise exception/);
  assert.match(revert, /set status = 'published' where id = previous_form_id/);
});

test("migration and revert have single transactions and readable SQL lines", () => {
  for (const sql of [migration, revert]) {
    assert.equal((sql.match(/^begin;/gm) ?? []).length, 1);
    assert.equal((sql.match(/^commit;/gm) ?? []).length, 1);
    assert.ok(sql.trimEnd().endsWith("commit;"));
    assert.ok(sql.split("\n").every((line) => line.length <= 160));
  }
});

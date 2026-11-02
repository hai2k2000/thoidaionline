import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = "supabase/migrations/20261103120000_database_management_v1_doan_the_parent.sql";
const revertPath = "scripts/production/database-management-doan-the-parent-revert.sql";
const childCodes = [
  "cong_tac_dang",
  "chi_hoi_nha_bao",
  "cong_doan",
  "doan_thanh_nien",
  "cuc_bao_chi",
  "lien_hiep",
  "phap_ly_dieu_hanh",
];

test("doan the parent migration preserves child restrictions and hierarchy contract", () => {
  assert.equal(existsSync(migrationPath), true);
  const migration = readFileSync(migrationPath, "utf8");
  assert.match(migration, /doan_the_quan_ly/);
  for (const code of childCodes) assert.match(migration, new RegExp(code));
  assert.match(migration, /parent_id/i);
  assert.match(migration, /do \$assert\$/i);
  const childUpdate = migration.match(/update public\.db_categories set parent_id = [^;]+;/i)?.[0] ?? "";
  assert.doesNotMatch(childUpdate, /restricted/i);
});

test("doan the parent revert detaches all child categories", () => {
  assert.equal(existsSync(revertPath), true);
  const revert = readFileSync(revertPath, "utf8");
  assert.match(revert, /parent_id\s*=\s*null/i);
  for (const code of childCodes) assert.match(revert, new RegExp(code));
});

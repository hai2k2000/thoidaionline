import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261102140000_database_management_v1_p2_restricted_groups.sql", "utf8");
const revert = readFileSync("scripts/production/database-management-p2-restricted-groups-revert.sql", "utf8");
const catalog = readFileSync("src/app/api/database/catalog/route.ts", "utf8");
const grants = readFileSync("src/app/api/permissions/users/[userId]/category-grants/route.ts", "utf8");
const detail = readFileSync("src/components/permissions/UserPermissionDetail.tsx", "utf8");
const categorySection = readFileSync("src/components/permissions/CategoryGrantsSection.tsx", "utf8");

test("migration uses one transaction and explicit restricted hierarchy", () => {
  assert.equal((migration.match(/^begin;$/gim) ?? []).length, 1);
  assert.equal((migration.match(/^commit;$/gim) ?? []).length, 1);
  assert.ok(migration.trimStart().startsWith("begin;"));
  assert.ok(migration.trimEnd().endsWith("commit;"));
  assert.match(migration, /db_category_is_restricted/);
  assert.equal((migration.match(/create or replace function public\.api_search_database_records/gi) ?? []).length, 1);
  assert.match(migration, /parent_id/);
  assert.doesNotMatch(migration, /regexp_replace\s*\(/i);
  assert.doesNotMatch(migration.replace(/do \$assert\$[\s\S]*?\$assert\$;/i, ""), /pg_get_functiondef\s*\(/i);
});

test("migration publishes forms and final assertions for every active moved type", () => {
  for (const token of [
    "dang_ho_so_dang_vien", "dang_khen_thuong_ky_luat", "cong_doan_tai_chinh",
    "lien_hiep_bao_cao_theo_yeu_cau", "phap_ly_to_chuc_hoat_dong",
    "status='retired'", "published form count invalid", "record type counts invalid",
    "db_category_access_grants", "doan_the_quan_ly",
  ]) assert.ok(migration.includes(token), token);
});

test("transition loads category grants and migration preserves shared scope function", () => {
  assert.match(migration, /select g\.level into v_category_grant[\s\S]*db_category_access_grants/i);
  assert.doesNotMatch(migration, /create or replace function public\.rbac_v2_scope_supported/i);
});

test("every select field has object value-label options", () => {
  const selectRows = migration.split("\n").filter((line) => line.includes("'select'"));
  assert.ok(selectRows.length > 0);
  for (const row of selectRows) {
    assert.doesNotMatch(row, /'\[\]'::jsonb/);
    assert.match(row, /"value"\s*:/);
    assert.match(row, /"label"\s*:/);
    assert.doesNotMatch(row, /\[\s*"[^"]+"\s*(?:,|\])/);
  }
});

test("grant API and UI support managed restricted categories", () => {
  for (const token of ["permission.manage", "restricted", "granted_by", "permission_history", "none", "view", "contribute", "approve"])
    assert.ok((grants + "\n" + detail).includes(token), token);
  assert.match(categorySection, /Nhóm hồ sơ hạn chế/);
  assert.match(categorySection, /Không/);
  assert.match(catalog, /contribute/);
  assert.match(catalog, /approve/);
});

test("revert restores RPCs and documents irreversible data changes", () => {
  assert.equal((revert.match(/create or replace function public\.api_search_database_records/gi) ?? []).length, 1);
  assert.match(revert, /api_transition_database_record/);
  assert.match(revert, /không tự động đảo ngược/i);
  assert.match(revert, /drop table if exists public\.db_category_access_grants/);
});

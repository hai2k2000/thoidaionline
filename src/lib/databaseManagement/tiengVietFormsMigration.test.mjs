import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261102170000_database_management_v1_to_tieng_viet_forms.sql", "utf8");

test("Tổ Tiếng Việt migration has one transaction and all ten types", () => {
  assert.equal((migration.match(/^begin;$/gim) ?? []).length, 1);
  assert.equal((migration.match(/^commit;$/gim) ?? []).length, 1);
  for (const code of ["danh_ba_nghiep_vu", "du_lieu_nen_linh_vuc", "ho_so_de_tai_tuyen_bai_chuyen_de", "giai_bao_chi_san_pham_tieu_bieu", "ho_so_nhan_vat", "ho_so_phong_van", "ho_so_su_kien", "ho_so_to_chuc_doi_tac", "kho_anh_video", "van_kien_tai_lieu_chi_dao_tu_lieu"]) assert.match(migration, new RegExp(code));
  assert.match(migration, /only title may be required/);
  assert.match(migration, /record_code must be hidden/);
  assert.match(migration, /keywords must be text/);
});

test("migration uses matching tagged dollar-quoted blocks", () => {
  assert.doesNotMatch(migration, /^as \$$/m);
  const blocks = [...migration.matchAll(/\b(as|do) \$([A-Za-z_][A-Za-z0-9_]*)\$/g)];
  assert.ok(blocks.length > 0);
  for (const [, , tag] of blocks) {
    assert.equal((migration.match(new RegExp(`\\$${tag}\\$`, "g")) ?? []).length, 2);
    assert.match(migration, new RegExp(`\\$${tag}\\$;`));
  }
});


test("To Tieng Viet scopes visible fields by type", () => {
  assert.doesNotMatch(migration, /set hidden = false, label = case field_key/);
  assert.match(migration, /unexpected visible field/);
  assert.match(migration, /expected field is hidden or missing/);
  assert.ok(migration.includes("f.field_key in ('title', 'summary', 'keywords', 'responsible_person', 'publication_url', 'reference_url', 'status')"));
  assert.match(migration, /tv_fields expected/);
  for (const field of ["issued_date", "organization", "subject", "activity_date", "location", "event_name", "event_datetime", "event_location", "participants", "materials", "related_activities", "organizer_department"]) {
    assert.match(migration, new RegExp(field));
  }
});

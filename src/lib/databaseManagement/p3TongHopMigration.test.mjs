import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = "supabase/migrations/20261103100000_database_management_v1_p3_tong_hop_subgroups.sql";
const revertPath = "scripts/production/database-management-p3-tong-hop-subgroups-revert.sql";
const movedTypes = [
  "van_ban_den",
  "van_ban_di",
  "so_sach_van_thu_luu_tru",
  "bieu_mau_hanh_chinh",
  "bao_cao",
  "bien_ban_ket_luan_hop",
  "ho_so_cong_viec_trong_tam",
  "ke_hoach_cong_tac",
  "phieu_giao_viec",
  "van_ban_noi_bo",
  "cho_phan_loai",
];

test("phase 3 migration contains the approved categories, types, and form contracts", () => {
  const migration = readFileSync(migrationPath, "utf8");
  for (const code of ["tong_hop_van_thu_luu_tru", "tong_hop_to_chuc_can_bo", "tong_hop_chung"]) {
    assert.match(migration, new RegExp(code));
  }
  assert.match(migration, /tong_hop_to_chuc_can_bo[\s\S]*true/);
  for (const code of [
    ...movedTypes,
    "tccb_tai_lieu_ho_so_nhan_su",
    "tccb_hop_dong_lao_dong",
    "tccb_bien_dong_nhan_su",
    "tccb_danh_gia_khen_thuong_ky_luat",
  ]) {
    assert.match(migration, new RegExp(code));
  }
  for (const key of ["so_den", "muc_do_khan", "do_mat", "tinh_trang_xu_ly", "noi_nhan", "nhan_su", "so_quyet_dinh"]) {
    assert.match(migration, new RegExp(key));
  }
  assert.doesNotMatch(migration, /"key":"[^"]*luong[^"]*"/i);
  const inserts = migration.match(/insert into public\.db_form_fields[\s\S]*?;/g) ?? [];
  assert.ok(inserts.length > 0);
  for (const statement of inserts) {
    assert.match(statement, /form_definition_id, field_key, label, data_type, required, searchable/);
    assert.match(statement, /on conflict \(form_definition_id, field_key\) do update set/);
  }
  assert.match(migration, /max\s*\(\s*f\.version\s*\)/i);
  assert.match(migration, /\$assert\$/);
  assert.match(readFileSync(revertPath, "utf8"), /^-- .*20261103100000_database_management_v1_p3_tong_hop_subgroups\.sql\.$/m);
});

test("phase 3 updates records for all moved types", () => {
  const sql = readFileSync(migrationPath, "utf8");
  const recordUpdate = sql.match(/update public\.db_records[\s\S]*?;/)?.[0] ?? "";
  for (const code of movedTypes) assert.match(recordUpdate, new RegExp(code));
  assert.match(recordUpdate, /cho_phan_loai/);
  assert.doesNotMatch(recordUpdate, /tccb_/);
});

test("phase 3 migration avoids PL/pgSQL alias collisions and upserts redesigned fields", () => {
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(sql, /item record/);
  assert.doesNotMatch(sql, /field_item jsonb/);
  assert.match(sql, /from public\.db_form_fields src/);
  assert.match(sql, /on conflict \(form_definition_id, field_key\) do update set/);
  assert.match(sql, /validation\s*=\s*excluded\.validation/);
});

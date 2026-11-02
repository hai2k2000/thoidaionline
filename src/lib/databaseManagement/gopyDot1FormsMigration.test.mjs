import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261102190000_database_management_v1_gopy_dot1_forms.sql", "utf8");
const revert = readFileSync("scripts/production/database-management-gopy-dot1-forms-revert.sql", "utf8");

test("dot1 migration contains approved form groups and safeguards", () => {
  assert.equal((migration.match(/^begin;$/gim) ?? []).length, 1);
  assert.equal((migration.match(/^commit;$/gim) ?? []).length, 1);
  for (const code of ["khach_hang_doi_tac", "de_xuat_bao_gia_thuong_thao", "hop_dong_nghiep_vu", "san_pham_truyen_thong_hop_dong", "nghiem_thu_ban_giao_thanh_ly", "tham_chieu_thanh_toan_quyet_toan", "tai_tro_quang_cao_hop_tac", "kho_thiet_ke_nhan_dien", "bao_cao_thong_ke_nghiep_vu", "ngoai_ngu_ho_so_nhan_vat"]) assert.match(migration, new RegExp(code));
  for (const field of ["so_hop_dong", "ma_khach_hang", "tinh_trang_hop_dong", "tong_gia_tri", "birth_date", "career_history"]) assert.match(migration, new RegExp(field));
  assert.match(migration, /retired/);
  assert.ok(migration.includes("'Người phụ trách'"));
  assert.doesNotMatch(migration, /ph\? tr/);
  assert.match(migration, /max\(f2\.version\)/);
  assert.match(migration, /\$assert\$/);
  assert.match(migration, /danh_ba_nghiep_vu.*ngoai_ngu_danh_ba_doi_tac/);
  assert.match(revert, /danh_ba_nghiep_vu_department_only/);
  assert.doesNotMatch(migration, /insert into public\.db_form_fields\s+(?!\(form_definition_id,)/i);
  assert.match(migration, /published source form missing/);
  assert.match(migration, /only title may be required/);
  assert.doesNotMatch(migration, /declare\s+t\s+record/i);
  assert.doesNotMatch(migration, /for\s+t\s+in/i);
  assert.doesNotMatch(migration, /status_options/i);
  assert.match(migration, /\[\{"value":"draft","label":"\u004e\u0068\u00e1\u0070"\},\{"value":"pending_review","label":"\u0043\u0068\u1edd\u0020\u0064\u0075\u0079\u1ec7\u0074"\},\{"value":"approved","label":"\u0110\u00e3\u0020\u0064\u0075\u0079\u1ec7\u0074"\},\{"value":"archived","label":"\u004c\u01b0\u0075\u0020\u0074\u0072\u1eef"\}\]/u);
  assert.ok(revert.includes("Nhân vật, đối tác, chuyên gia, cộng tác viên"));
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = "supabase/migrations/20261102160000_database_management_v1_p2_form_fields_fix.sql";
const revertPath = "scripts/production/database-management-p2-form-fields-fix-revert.sql";

test("p2 form fields fix is transactional and uses set-based form cloning", () => {
  const migration = readFileSync(migrationPath, "utf8");
  assert.equal((migration.match(/^begin;$/gim) ?? []).length, 1);
  assert.equal((migration.match(/^commit;$/gim) ?? []).length, 1);
  assert.ok(migration.trimStart().startsWith("begin;"));
  assert.ok(migration.trimEnd().endsWith("commit;"));
  assert.match(migration, /insert into public\.db_form_definitions[\s\S]*max\([^)]*version\)/i);
  assert.match(migration, /insert into public\.db_form_fields[\s\S]*select/i);
  assert.match(migration, /do \$assert\$/i);
  assert.doesNotMatch(migration, /pg_get_functiondef\s*\(/i);
});

test("p2 form fields fix generates distinct new form ids per type", () => {
  const migration = readFileSync(migrationPath, "utf8");
  assert.doesNotMatch(migration, /lateral\s*\(\s*select\s+gen_random_uuid\s*\(/i);
  assert.match(migration, /select\s+t\.id,\s*t\.code,\s*old_form\.id,\s*gen_random_uuid\(\)/i);
  assert.match(migration, /count\s*\(distinct\s+new_form_id\)\s*=\s*count\(\*\)/i);
});

test("p2 form fields fix contains every corrected option table and field type", () => {
  const migration = readFileSync(migrationPath, "utf8");
  for (const label of [
    "Nghị quyết", "Chỉ thị", "Kết luận", "Quy định", "Hướng dẫn", "Kế hoạch", "Công văn",
    "Chưa thực hiện", "Đang thực hiện", "Hoàn thành",
    "Hoàn thành xuất sắc nhiệm vụ", "Hoàn thành tốt nhiệm vụ", "Hoàn thành nhiệm vụ", "Không hoàn thành nhiệm vụ",
    "Quyết định", "Thông báo", "Báo cáo", "Khác",
    "Đang sinh hoạt", "Chuyển đi", "Thôi sinh hoạt",
    "Còn hiệu lực", "Hết hiệu lực", "Bị thay thế",
    "Tháng", "Quý", "6 tháng", "Năm",
  ]) assert.ok(migration.includes(`"value":"${label}"`) && migration.includes(`"label":"${label}"`), label);
  assert.match(migration, /keywords[\s\S]*'text'/i);
  assert.match(migration, /con_phai_thu[\s\S]*'number'/i);
  assert.match(migration, /dang_dai_hoi[\s\S]*Văn kiện, báo cáo, biên bản đại hội đính kèm ở mục Tệp\./i);
  assert.match(migration, /cong_doan_thu_doan_phi[\s\S]*Đính kèm file danh sách thu ở mục Tệp\./i);
  assert.match(migration, /cong_doan_tai_chinh[\s\S]*Đính kèm sổ\/chứng từ ở mục Tệp\./i);
  assert.match(migration, /Đính kèm tài liệu chi tiết ở mục Tệp\./);
  assert.match(migration, /validation\s*-\s*'help'/i);
});

test("p2 form fields fix has no mojibake or replacement question marks", () => {
  for (const path of [migrationPath, revertPath]) {
    const content = readFileSync(path, "utf8");
    assert.doesNotMatch(content, /\u00c3|\u00e1\u00bb|\u00c6\u00b0/);
    assert.doesNotMatch(content, /\p{L}\?\p{L}/u);
  }
});

test("p2 form fields fix revert documents the dependent-record limitation", () => {
  const revert = readFileSync(revertPath, "utf8");
  assert.match(revert, /form mới|new form/i);
  assert.match(revert, /không revert|không thể revert|không.*revert/i);
  assert.match(revert, /db_form_definitions/);
  assert.match(revert, /db_records/);
});

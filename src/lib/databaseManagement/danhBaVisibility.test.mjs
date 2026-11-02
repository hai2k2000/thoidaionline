import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync("src/lib/databaseManagement/repository.ts", "utf8");
const form = readFileSync("src/components/DatabaseRecordForm.tsx", "utf8");
const migration = readFileSync("supabase/migrations/20261102170000_database_management_v1_to_tieng_viet_forms.sql", "utf8");

test("Danh bạ nghiệp vụ is department-only in repository, UI, and database", () => {
  assert.equal((repository.match(/danh_ba_department_only/g) ?? []).length, 2);
  assert.match(form, /Danh bạ nghiệp vụ chỉ dùng trong phòng\./);
  assert.match(form, /disabled=\{isDanhBa\}/);
  assert.match(form, /Tài liệu chung trong nội bộ Tạp chí/);
  assert.match(migration, /enforce_danh_ba_department_visibility/);
  assert.match(migration, /set visibility='department'/);
});

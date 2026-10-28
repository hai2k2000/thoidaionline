import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const migration = readFileSync(fileURLToPath(new URL("../../../supabase/migrations/20261017100000_database_management_v1_foundation.sql", import.meta.url)), "utf8");
const catalog = readFileSync(fileURLToPath(new URL("../../../supabase/migrations/20261017101000_database_management_v1_catalog.sql", import.meta.url)), "utf8");
const languageGroup = readFileSync(fileURLToPath(new URL("../../../supabase/migrations/20261020130000_database_management_v1_language_groups.sql", import.meta.url)), "utf8");
const autocode = readFileSync(fileURLToPath(new URL("../../../supabase/migrations/20261020100000_database_management_v1_autocode.sql", import.meta.url)), "utf8");
const filterApproval = readFileSync(fileURLToPath(new URL("../../../supabase/migrations/20261021100000_database_management_v1_filter_approval.sql", import.meta.url)), "utf8");
const listFilters = readFileSync(fileURLToPath(new URL("../../../supabase/migrations/20261027140000_database_management_v1_list_filters.sql", import.meta.url)), "utf8");
const dropSourcePerson = readFileSync(fileURLToPath(new URL("../../../supabase/migrations/20261027160000_database_management_v1_drop_source_person.sql", import.meta.url)), "utf8");
const doanThe = readFileSync(fileURLToPath(new URL("../../../supabase/migrations/20261028090000_database_management_v1_doan_the_types.sql", import.meta.url)), "utf8");
const recordTypeSort = readFileSync(fileURLToPath(new URL("../../../supabase/migrations/20261028120000_database_management_v1_record_type_sort_order.sql", import.meta.url)), "utf8");

test("record type sort migration adds the nullable column and approved doan the order", () => {
  assert.match(recordTypeSort, /alter table public\.db_record_types add column if not exists sort_order integer/i);
  const codes = ["dang_van_ban_dinh_ky", "dang_dai_hoi", "dang_tong_ket_nam", "dang_bien_ban_sinh_hoat", "dang_sinh_hoat_chuyen_de", "dang_bao_cao_cong_van", "nha_bao_van_ban_den", "nha_bao_van_ban_di", "nha_bao_hoi_vien", "nha_bao_dai_hoi", "nha_bao_van_ban_khac", "doan_tn_van_ban", "cuc_bc_giay_phep_dai_han", "cuc_bc_giay_phep_ngan_han", "cuc_bc_bao_cao", "cuc_bc_the_nha_bao"];
  for (const [index, code] of codes.entries()) assert.match(recordTypeSort, new RegExp(`'${code}'[\\s\\S]{0,160}${(index + 1) * 10}`));
  assert.match(recordTypeSort, /update public\.db_record_types[\s\S]*where record_type\.code = type_order\.code/i);
});

test("doan the migration defines the approved flat catalog and admin-only sensitivity grant", () => {
  const codes = ["dang_van_ban_dinh_ky", "dang_dai_hoi", "dang_tong_ket_nam", "dang_bien_ban_sinh_hoat", "dang_sinh_hoat_chuyen_de", "dang_bao_cao_cong_van", "nha_bao_van_ban_den", "nha_bao_van_ban_di", "nha_bao_hoi_vien", "nha_bao_dai_hoi", "nha_bao_van_ban_khac", "doan_tn_van_ban", "cuc_bc_giay_phep_dai_han", "cuc_bc_giay_phep_ngan_han", "cuc_bc_bao_cao", "cuc_bc_the_nha_bao"];
  assert.match(doanThe, /update public\.db_categories[\s\S]*Các tổ chức đoàn thể/);
  for (const code of codes) assert.match(doanThe, new RegExp(`'${code}'`));
  assert.match(doanThe, /active = false/);
  assert.match(doanThe, /code='admin'/);
  assert.match(doanThe, /code='record\.sensitive\.access'/);
  assert.match(doanThe, /perm_id,'all'/);
  assert.match(doanThe, /code\s*=\s*'doan_the_quan_ly'/i);
  assert.doesNotMatch(doanThe, /regexp_replace|\bexecute\s+(?:fn|format)/i);
  assert.match(doanThe, /create or replace function public\.api_search_database_records\([\s\S]*doan_the_quan_ly/);
  assert.match(doanThe, /create or replace function public\.api_transition_database_record\([\s\S]*doan_the_quan_ly/);
  assert.match(doanThe, /do \$assert_sensitive\$[\s\S]*pg_get_functiondef[\s\S]*prokind = 'f'[\s\S]*admin-only/);
});

test("source_person retirement removes obsolete fields and strips orphaned metadata", () => {
  assert.match(dropSourcePerson, /^begin;[\s\S]*delete from public\.db_form_fields\s+where field_key = 'source_person';[\s\S]*commit;\s*$/i);
  assert.match(dropSourcePerson, /update public\.db_records\s+set metadata = metadata - 'source_person'\s+where metadata \? 'source_person'/i);
  assert.doesNotMatch(dropSourcePerson, /owner_id|permission|rpc/i);
});

test("foundation migration is additive, indexed, server-only and ACL-capable", () => {
  for (const table of ["db_categories", "db_record_types", "db_form_definitions", "db_form_fields", "db_records", "db_record_files", "db_record_external_links", "db_record_acl", "db_record_history", "db_saved_search_filters"]) assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
  assert.match(migration, /record\.download/);
  assert.match(migration, /revoke all on table public\.%I from public, anon, authenticated/);
  assert.match(migration, /using gin\(search_document\)/);
  assert.match(migration, /create trigger db_records_search_document_trigger/);
  assert.doesNotMatch(migration, /grant .* to anon|grant .* to authenticated/i);
});

test("catalog migration does not invent a thirteenth top-level group", () => {
  assert.equal((catalog.match(/values\r?\n\s*\('tong_hop'/)?.length ?? 0), 1);
  assert.match(catalog, /'doan_the_quan_ly'/);
  assert.match(catalog, /db_form_definitions/);
  assert.match(catalog, /db_form_fields/);
});

test("language group migration is additive and keeps stable language codes", () => {
  assert.match(languageGroup, /add column if not exists language_code/);
  assert.match(languageGroup, /'phong_noi_dung'/);
  for (const code of ["vi", "en", "zh", "lo", "km"]) assert.match(languageGroup, new RegExp(`'${code}'`));
  assert.doesNotMatch(languageGroup, /delete from public\.db_records|drop table public\.db_records/i);
  assert.match(languageGroup, /db_records_language_idx/);
});

test("production artifact contracts include the language group migration", () => {
  const packager = readFileSync(fileURLToPath(new URL("../../../scripts/package-standalone.mjs", import.meta.url)), "utf8");
  const verifier = readFileSync(fileURLToPath(new URL("../../../scripts/verify-standalone-artifact.mjs", import.meta.url)), "utf8");
  for (const source of [packager, verifier]) assert.match(source, /20261020130000_database_management_v1_language_groups\.sql/);
});

test("production artifact contracts include the self-approval migration", () => {
  const packager = readFileSync(fileURLToPath(new URL("../../../scripts/package-standalone.mjs", import.meta.url)), "utf8");
  const verifier = readFileSync(fileURLToPath(new URL("../../../scripts/verify-standalone-artifact.mjs", import.meta.url)), "utf8");
  for (const source of [packager, verifier]) assert.match(source, /20261024110000_database_management_v1_self_approval\.sql/);
});

test("CP2 specialized fields stay limited to source-backed record contracts", () => {
  for (const field of ["document_number", "sender_organization", "processing_deadline", "original_location"]) assert.match(catalog, new RegExp(`'${field}'`));
  for (const field of ["contract_number", "signed_date", "term_end_date", "execution_status"]) assert.match(catalog, new RegExp(`'${field}'`));
  for (const field of ["event_name", "event_datetime", "event_location", "organizer_department", "related_country", "participants"]) assert.match(catalog, new RegExp(`'${field}'`));
  assert.match(catalog, /specialized here/i);
});

test("autocode migration is additive and allocates Vietnam-year codes atomically", () => {
  assert.match(autocode, /create table if not exists public\.db_record_code_counters/);
  assert.match(autocode, /create or replace function public\.api_next_database_record_code/);
  assert.match(autocode, /timezone\('Asia\/Ho_Chi_Minh', now\(\)\)/);
  assert.match(autocode, /on conflict \(code_year\) do update/);
  assert.match(autocode, /grant execute on function public\.api_next_database_record_code\(\) to service_role/);
  assert.doesNotMatch(autocode, /grant execute .*anon|grant execute .*authenticated/i);
});

test("idempotency migration adds request keys without rewriting existing records", () => {
  const source = readFileSync(fileURLToPath(new URL("../../../supabase/migrations/20261020110000_database_management_v1_idempotency.sql", import.meta.url)), "utf8");
  assert.match(source, /add column if not exists client_request_id/i);
  assert.match(source, /add column if not exists upload_request_id/i);
  assert.match(source, /create unique index/);
});

test("filter and approval migration is additive and fail-closed", () => {
  assert.match(filterApproval, /child\.parent_id = p_category_id/);
  assert.match(filterApproval, /api_transition_database_record/);
  assert.match(filterApproval, /record\.approve/);
  assert.match(filterApproval, /Self approval is not allowed/);
  assert.match(filterApproval, /Return reason is required/);
  assert.match(filterApproval, /for update/);
  assert.doesNotMatch(filterApproval, /drop table|delete from public\.db_records/i);
});

test("list filters replace the old RPC signature without weakening visibility", () => {
  assert.match(listFilters, /drop function if exists public\.api_search_database_records\(uuid, text, text, uuid, uuid, integer, integer\)/i);
  assert.match(listFilters, /p_created_from date default null[\s\S]*p_has_files boolean default null[\s\S]*p_keyword text default null/i);
  assert.match(listFilters, /p_sort in \('updated_at','created_at','record_code','title','status'\)/);
  assert.match(listFilters, /lower\(p_sort_dir\) in \('asc','desc'\)/);
  assert.doesNotMatch(listFilters, /execute\s+format|execute\s+[^;]*p_sort/i);
  for (const invariant of [
    "r.status <> 'deleted'",
    "c.explicitly_allowed or ps.can_all or (ps.can_department and c.same_department) or (ps.can_assigned and c.is_owner) or (ps.can_self and c.is_owner)",
    "and not c.explicitly_denied",
  ]) assert.ok(filterApproval.includes(invariant) && listFilters.includes(invariant), invariant);
  assert.match(listFilters, /revoke all on function public\.api_search_database_records[\s\S]*from public, anon, authenticated/i);
  assert.match(listFilters, /grant execute on function public\.api_search_database_records[\s\S]*to service_role/i);
  assert.match(listFilters, /security definer set search_path = public, pg_temp/i);
  assert.match(listFilters, /owner to postgres/i);
});

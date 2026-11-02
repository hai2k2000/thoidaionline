import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const migrationUrl = new URL("../../../supabase/migrations/20261102100000_database_management_v1_noidung_forms.sql", import.meta.url);
const migrationPath = fileURLToPath(migrationUrl);
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

test("Phong Nội dung migration is transactional, additive and idempotent", () => {
  assert.ok(migration, "migration file must exist");
  assert.match(migration, /^begin;/i);
  assert.match(migration, /commit;\s*$/i);
  assert.doesNotMatch(migration, /\bdelete\s+from\b/i);
  assert.match(migration, /add column if not exists hidden boolean not null default false/i);
  assert.match(migration, /on conflict \(form_definition_id, field_key\) do update/i);
  assert.match(migration, /on conflict \(code\) do update/i);
});

test("migration defines every newly approved field key", () => {
  const fieldKeys = [
    "contact_type", "position", "phone", "email", "address", "contact_language",
    "org_type", "founded_year", "leader", "event_type", "event_location", "co_organizer",
    "participants", "event_result", "document_type", "document_number", "effective_date",
    "work_type", "start_date", "due_date", "team", "outputs", "data_kind", "interviewee",
    "interview_format", "source_doc_type", "received_date", "usage_rights", "resource_type",
    "vi_term", "standard_translation",
  ];
  for (const fieldKey of fieldKeys) assert.match(migration, new RegExp(`'${fieldKey}'`), fieldKey);
});

test("migration creates eleven active foreign-language types and closes with assertions", () => {
  for (const code of ["ngoai_ngu_ho_so_su_kien", "ngoai_ngu_ho_so_van_kien", "noi_dung_tieng_nga", "ru"]) {
    assert.match(migration, new RegExp(`'${code}'`), code);
  }
  assert.match(migration, /count\(\*\)[\s\S]*<>\s*11/i);
  assert.match(migration, /field_key\s*=\s*'title'[\s\S]*hidden\s*=\s*false/i);
  assert.match(migration, /raise exception/i);
  assert.match(migration, /notify pgrst, 'reload schema'/i);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const repository = read("./repository.ts");
const audit = read("./auditOutbox.ts");
const restoreRoute = read("../../app/api/database/records/[id]/restore/route.ts");
const recordRoute = read("../../app/api/database/records/[id]/route.ts");
const uploadRoute = read("../../app/api/database/records/[id]/files/route.ts");
const fileRoute = read("../../app/api/database/records/[id]/files/[fileId]/route.ts");
const page = read("../../app/database/records/[id]/page.tsx");
const migration = read("../../../supabase/migrations/20261031100000_database_management_v1_p2_search_hardening.sql");
const revert = read("../../../scripts/production/database-management-p2-search-hardening-revert.sql");

test("P2 status and visibility guards are enforced", () => {
  assert.match(repository, /current\.status !== "deleted"[\s\S]*record_not_deleted/);
  assert.match(repository, /current\.status === "deleted"[\s\S]*record_already_deleted/);
  assert.match(repository, /\.eq\("status", current\.status\)[\s\S]*\.maybeSingle\(\)/);
  assert.match(repository, /if \(!data\) throw new Error\("record_locked"\)/);
  assert.match(repository, /rbacPermissions\.includes\("record\.discover"\)/);
  assert.match(repository, /record\.owner_id && record\.owner_id === actor\.id/);
  assert.match(repository, /capability === "acl\.manage"\) return visibilityAllowed/);
  assert.doesNotMatch(repository, /capability === "acl\.manage"\) return true/);
  for (const source of [restoreRoute, recordRoute]) for (const code of ["record_not_deleted", "record_already_deleted", "record_locked"]) assert.match(source, new RegExp(code));
});

test("P2 audit, file deletion, MIME and UI contracts exist", () => {
  assert.match(audit, /retryPendingAudits\(10\)/);
  assert.match(uploadRoute, /databaseRecordFileType/);
  assert.doesNotMatch(uploadRoute, /mime_type:\s*file\.type/);
  assert.match(uploadRoute, /unsupported_file_type[\s\S]*415/);
  assert.match(fileRoute, /X-Content-Type-Options.*nosniff/);
  assert.match(fileRoute, /filename\*=UTF-8''/);
  assert.match(fileRoute, /export async function DELETE/);
  assert.match(fileRoute, /deleteDatabaseRecordFile/);
  assert.match(page, /deleteFile/);
  assert.match(page, /file_delete:/);
});

test("P2 search and approval queue contracts are hardened", () => {
  const search = migration.slice(0, migration.indexOf("create or replace function public.api_transition_database_record"));
  assert.match(search, /ps\.can_discover/);
  assert.match(search, /c\.is_owner/);
  assert.match(search, /regexp_count\(trim\(coalesce\(p_q, ''\)\), '\\S\+'\)/);
  assert.equal((search.match(/api_list_effective_permissions/g) ?? []).length, 1);
  assert.match(search, /revoke all on function public\.api_search_database_records/);
  assert.match(search, /grant execute on function public\.api_search_database_records/);
  assert.doesNotMatch(migration, /api_transition_database_record/);
  assert.doesNotMatch(migration, /create table/);
  assert.equal((migration.match(/\bcommit;/g) ?? []).length, 1);
  assert.match(migration, /do \$assert\$[\s\S]*begin/);
  assert.match(repository, /\.in\("record_id", ids\)/);
});

test("P2 search hardening revert restores only the search function and ledger state", () => {
  assert.match(revert, /api_search_database_records/);
  assert.doesNotMatch(revert, /api_transition_database_record/);
  assert.match(revert, /regexp_count\(trim\(coalesce\(p_q, ''\)\), '\\\\S\+'\)/);
  assert.match(revert, /delete from supabase_migrations\.schema_migrations where version = '20261031100000';/);
  assert.equal((revert.match(/\bcommit;/g) ?? []).length, 1);
});
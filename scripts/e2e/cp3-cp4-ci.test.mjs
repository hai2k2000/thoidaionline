import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../../.github/workflows/cp3-cp4-ci.yml", import.meta.url), "utf8");
const fixture = readFileSync(new URL("./start-sandbox.sh", import.meta.url), "utf8");
const sql = readFileSync(new URL("./cp3-runtime.sql", import.meta.url), "utf8");
const cp4 = readFileSync(new URL("./cp4-runtime.mjs", import.meta.url), "utf8");
const searchFix = readFileSync(new URL("../../supabase/migrations/20261018100000_database_management_v1_cp3_search_rpc_identifier_fix.sql", import.meta.url), "utf8");
const scopeFix = readFileSync(new URL("../../supabase/migrations/20261018120000_database_management_v1_cp3_search_scope_fix.sql", import.meta.url), "utf8");

test("CP3/CP4 workflow is manual-only and bounded", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /(^|\n)\s+(push|pull_request):/);
  assert.match(workflow, /runs-on:\s*ubuntu-24\.04/);
  assert.match(workflow, /timeout-minutes:\s*30/);
  assert.match(workflow, /retention-days:\s*3/);
  assert.match(workflow, /E2E_STRICT_GRANTS:\s*["']?1/);
  assert.doesNotMatch(workflow, /deploy-gate|production-artifact|VPS|THOIDAI_PUBLIC_SUPABASE_URL/);
  assert.match(workflow, /docker rm -f/);
  assert.match(workflow, /docker network rm/);
});

test("strict fixture applies CP3 and does not grant public tables", () => {
  assert.match(fixture, /20261017100000_database_management_v1_foundation\.sql/);
  assert.match(fixture, /20261017101000_database_management_v1_catalog\.sql/);
  assert.match(fixture, /20261017110000_database_management_v1_cp2b_optional_fields\.sql/);
  assert.match(fixture, /20261017130000_database_management_v1_cp3_search_rpc\.sql/);
  assert.match(fixture, /20261017140000_database_management_v1_cp3_search_security_fix\.sql/);
  assert.match(fixture, /20261018100000_database_management_v1_cp3_search_rpc_identifier_fix\.sql/);
  assert.match(fixture, /20261018120000_database_management_v1_cp3_search_scope_fix\.sql/);
  assert.match(fixture, /20261018130000_database_management_v1_cp6_audit_outbox\.sql/);
  assert.match(fixture, /E2E_STRICT_GRANTS/);
  assert.match(fixture, /revoke all on all tables in schema public from anon, authenticated/);
});

test("CP3 Search RPC scope fix is additive and preserves deny/default-deny boundaries", () => {
  assert.match(scopeFix, /create or replace function public\.api_search_database_records\(/i);
  assert.match(scopeFix, /permission_scope/);
  assert.match(scopeFix, /'self' = any\(discover_perm\.effective_scopes\)/);
  assert.match(scopeFix, /'assigned' = any\(discover_perm\.effective_scopes\)/);
  assert.match(scopeFix, /'department' = any\(discover_perm\.effective_scopes\)/);
  assert.match(scopeFix, /'all' = any\(discover_perm\.effective_scopes\)/);
  assert.match(scopeFix, /and not c\.explicitly_denied/);
  assert.match(scopeFix, /language plpgsql security definer set search_path = public, pg_temp/i);
  assert.match(scopeFix, /revoke all on function public\.api_search_database_records\([^;]+\) from public, anon, authenticated;/i);
  assert.match(scopeFix, /grant execute on function public\.api_search_database_records\([^;]+\) to service_role;/i);
  assert.doesNotMatch(scopeFix, /grant execute[^;]+\b(?:anon|authenticated)\b/i);
  assert.doesNotMatch(scopeFix, /record\.sensitive\.access[^;]+grant/i);
});

test("CP3 Search RPC identifier fix is additive and preserves security boundaries", () => {
  assert.match(searchFix, /create or replace function public\.api_search_database_records\(/i);
  assert.match(searchFix, /returns table\s*\([\s\S]*total_count bigint\s*\)/i);
  assert.match(searchFix, /language plpgsql security definer set search_path = public, pg_temp/i);
  assert.match(searchFix, /from public\.staff_users as su\s+where su\.id = p_actor_id/i);
  assert.doesNotMatch(searchFix, /from public\.staff_users\s+where\s+id\s*=/i);
  assert.doesNotMatch(searchFix, /#variable_conflict\s+use_column/i);
  assert.doesNotMatch(searchFix, /\bwhere\s+id\s*=/i);
  assert.doesNotMatch(searchFix, /\bmax\s*\(\s*total_count\s*\)/i);
  assert.match(searchFix, /revoke all on function public\.api_search_database_records\([^;]+\) from public, anon, authenticated;/i);
  assert.match(searchFix, /grant execute on function public\.api_search_database_records\([^;]+\) to service_role;/i);
  assert.doesNotMatch(searchFix, /grant execute[^;]+\b(?:anon|authenticated)\b/i);
  assert.doesNotMatch(searchFix, /record\.sensitive\.access[^;]+grant/i);
});

test("CP3 runtime checks cover authorization, search operators and side-channel safety", () => {
  assert.match(sql, /CP3_RUNTIME_PASS/);
  assert.match(sql, /explicitly denied|db_record_acl/);
  assert.match(sql, /now\(\) - interval '1 minute'/);
  assert.match(sql, /alpha -hidden/);
  assert.match(sql, /alpha OR gamma/);
  assert.match(sql, /denied metadata side-channel/);
  assert.match(sql, /allowed metadata search/);
  assert.match(sql, /denied summary side-channel/);
  assert.match(sql, /is distinct from array/);
  for (const token of ["restricted-ho-so-dang", "restricted-chi-hoi-nha-bao", "restricted-doan-thanh-nien", "restricted-giay-phep-quan-ly-bao-chi"]) assert.match(sql, new RegExp(token));
  assert.match(sql, /invalid actor was accepted/);
  assert.match(sql, /pagination failed/);
  assert.match(sql, /service-role execute grant missing/);
  assert.match(sql, /public table grant unexpectedly present/);
  assert.match(sql, /CP3-SENSITIVE/);
  assert.match(sql, /null, null, 100, 0/);
  assert.match(sql, /anon_select/);
  assert.match(sql, /authenticated_select/);
  assert.match(sql, /v_total_count bigint/);
  assert.match(sql, /max\(sr\.total_count\)/);
  assert.doesNotMatch(sql, /\btotal_count bigint/);
  assert.doesNotMatch(sql, /max\(total_count\)/);
  assert.match(sql, /from public\.api_search_database_records\([\s\S]*\) as sr/);
  for (const marker of ["CP3 scope self", "CP3 scope assigned", "CP3 scope department", "CP3 scope all", "CP3 user deny scope"]) assert.match(sql, new RegExp(marker));
});

test("CP4 runtime checks cover CRUD, private file integrity and lifecycle", () => {
  for (const marker of ["/api/database/catalog", "/api/database/records", "/files", "/export", "/restore", "sha256", "soft delete", "history"]) assert.match(cp4, new RegExp(marker.replaceAll("/", "\\/")));
  assert.match(cp4, /application\/pdf/);
  assert.match(cp4, /createHash/);
  assert.match(cp4, /upload checksum metadata mismatch/);
  assert.match(cp4, /download checksum mismatch/);
  assert.match(cp4, /history action missing/);
  assert.match(cp4, /CP4_RUNTIME_PASS/);
});

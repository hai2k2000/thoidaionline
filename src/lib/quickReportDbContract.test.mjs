import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../../supabase/migrations/20261001090000_quick_report_task_v1.sql", import.meta.url), "utf8");
const uxMigration = readFileSync(new URL("../../supabase/migrations/20261002150000_quick_report_ux_v2.sql", import.meta.url), "utf8");
const catalog = readFileSync(new URL("./rbac/permissionCatalog.ts", import.meta.url), "utf8");

test("quick report migration is additive and explicit", () => {
  for (const field of ["workflow_type", "report_category", "report_work_date", "report_started_time", "report_completed_time", "report_notes"]) {
    assert.match(migration, new RegExp(`add column if not exists ${field}`));
  }
  assert.match(migration, /workflow_type.*STANDARD.*REPORT_ONLY/s);
  assert.match(migration, /task\.quick_report\.create/);
  assert.match(migration, /api_create_quick_report_v1/);
  assert.match(migration, /revoke all on function/);
  assert.match(migration, /service_role/);
  assert.doesNotMatch(migration, /drop table|truncate table|supabase db push/i);
});

test("RBAC catalog exposes a dedicated quick-report permission", () => {
  assert.match(catalog, /task\.quick_report\.create/);
});

test("UX migration keeps the hardened RPC and validates date-only ranges", () => {
  assert.match(uxMigration, /create or replace function public\.api_create_quick_report_v1/);
  assert.match(uxMigration, /start_date date,completion_date date/);
  assert.match(uxMigration, /completion_date < v_row\.start_date/);
  assert.match(uxMigration, /grant execute on function/);
});

const payloadFixMigration = readFileSync(new URL("../../supabase/migrations/20261016120000_quick_report_rpc_payload_compatibility_fix.sql", import.meta.url), "utf8");
const repository = readFileSync(new URL("./taskRepository.ts", import.meta.url), "utf8");
const originalLegacyMigration = readFileSync(new URL("../../supabase/migrations/20261001090000_quick_report_task_v1.sql", import.meta.url), "utf8");

test("quick report compatibility wrapper restores the active legacy field contract", () => {
  assert.match(originalLegacyMigration, /work_date date,[\\s\\S]*started_time text,[\\s\\S]*completed_time text/);
  assert.match(repository, /work_date: row\\.startDate/);
  assert.match(repository, /started_time: "00:00"/);
  assert.match(repository, /completed_time: row\\.status === "done" \\? "00:00" : null/);
  assert.match(payloadFixMigration, /create or replace function public\\.api_create_quick_report_v1\\(/);
  assert.match(payloadFixMigration, /rbac_v2_has_effective_scope/);
  assert.match(payloadFixMigration, /'work_date', coalesce\\(item->>'work_date', item->>'start_date'\\)/);
  assert.match(payloadFixMigration, /'started_time', coalesce\\(nullif\\(item->>'started_time'/);
  assert.match(payloadFixMigration, /'completed_time', case/);
  assert.match(payloadFixMigration, /jsonb_agg\\([\\s\\S]*order by ordinal/);
  assert.match(payloadFixMigration, /return public\\.api_create_quick_report_v1_legacy\\(/);
  assert.match(payloadFixMigration, /grant execute on function public\\.api_create_quick_report_v1\\(uuid, uuid, jsonb\\) to service_role/);
  assert.doesNotMatch(payloadFixMigration, /(?:drop table|truncate table|supabase db push)/i);
});

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
const completionDateMigration = readFileSync(new URL("../../supabase/migrations/20261016130000_quick_report_completion_date_compatibility.sql", import.meta.url), "utf8");
const repository = readFileSync(new URL("./taskRepository.ts", import.meta.url), "utf8");
const originalLegacyMigration = readFileSync(new URL("../../supabase/migrations/20261001090000_quick_report_task_v1.sql", import.meta.url), "utf8");

test("quick report compatibility wrapper restores the active legacy field contract", () => {
  for (const token of ["work_date date", "started_time text", "completed_time text"]) {
    assert.ok(originalLegacyMigration.includes(token), `legacy RPC is missing ${token}`);
  }
  for (const token of ['work_date: row.startDate', 'completed_date: row.status === "done" ? row.completionDate : null', 'started_time: "00:00"', 'completed_time: row.status === "done" ? "00:00" : null']) {
    assert.ok(repository.includes(token), `repository no longer sends ${token}`);
  }
  for (const token of [
    "create or replace function public.api_create_quick_report_v1(",
    "rbac_v2_has_effective_scope",
    "'work_date', coalesce(item->>'work_date', item->>'start_date')",
    "'started_time', coalesce(nullif(item->>'started_time'",
    "'completed_time', case",
    "order by ordinal",
    "return public.api_create_quick_report_v1_legacy(",
    "grant execute on function public.api_create_quick_report_v1(uuid, uuid, jsonb) to service_role",
  ]) {
    assert.ok(payloadFixMigration.includes(token), `migration contract missing ${token}`);
  }
  assert.doesNotMatch(payloadFixMigration, /(?:drop table|truncate table|supabase db push)/i);
});

test("completion-date migration preserves old and new payload contracts", () => {
  for (const token of [
    "create or replace function public.api_create_quick_report_v1_legacy(",
    "completed_date date",
    "v_completed_date := coalesce(v_row.completed_date, v_row.work_date)",
    "v_completed_date < v_row.work_date",
    "v_completed_date + v_row.completed_time::time",
    "create or replace function public.api_create_quick_report_v1(",
    "'completed_date', case",
    "return public.api_create_quick_report_v1_legacy(",
  ]) assert.ok(completionDateMigration.includes(token), `migration contract missing ${token}`);
  assert.match(completionDateMigration, /item->>'completion_date'[\s\S]*coalesce\(nullif\(item->>'started_time'/);
  assert.doesNotMatch(completionDateMigration, /drop table|truncate table|supabase db push/i);
});

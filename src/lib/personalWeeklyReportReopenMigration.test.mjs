import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../../supabase/migrations/20261007100000_personal_weekly_report_reopen_versions.sql", import.meta.url);

test("weekly report reopen migration defines the immutable version contract", () => {
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(sql, /create table public\.personal_weekly_report_versions/i);
  for (const column of [
    "id uuid",
    "report_id uuid",
    "version_no integer",
    "employee_id uuid",
    "department_id uuid",
    "period_start date",
    "period_end date",
    "snapshot_payload jsonb",
    "difficulties text",
    "completed_by uuid",
    "completed_at timestamptz",
    "created_at timestamptz",
  ]) assert.match(sql, new RegExp(column.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  assert.match(sql, /references public\.personal_weekly_reports\s*\(id\)/i);
  assert.match(sql, /unique\s*\(report_id\s*,\s*version_no\)/i);
  assert.match(sql, /on public\.personal_weekly_report_versions\s*\(report_id\s*,\s*version_no desc\)/i);
  assert.match(sql, /create trigger .*versions.*immutable|create trigger .*immutable.*versions/is);
  assert.match(sql, /raise exception ['"]immutable personal weekly report versions/i);
  assert.doesNotMatch(sql, /personal_weekly_report_versions[^;]*on delete cascade/i);
});

test("completion and reopen RPCs are server-only and encode authorization rules", () => {
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(sql, /create or replace function public\.api_complete_personal_weekly_report/i);
  assert.match(sql, /insert into public\.personal_weekly_report_versions/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /create or replace function public\.api_reopen_personal_weekly_report\s*\(/i);
  assert.match(sql, /length\s*\(btrim\(p_reason\)\)\s*not\s+between\s*5\s*and\s*500/i);
  assert.match(sql, /interval\s*'24 hours'/i);
  assert.match(sql, /phase7_is_admin|r\.code\s*=\s*'admin'/i);
  assert.match(sql, /personal_weekly_report\.reopened/i);
  assert.match(sql, /revoke all on function public\.api_reopen_personal_weekly_report/i);
  assert.match(sql, /grant execute on function public\.api_reopen_personal_weekly_report[^;]*service_role/i);
  assert.match(sql, /revoke all on function public\.api_complete_personal_weekly_report/i);
  assert.match(sql, /grant execute on function public\.api_complete_personal_weekly_report[^;]*service_role/i);
});

test("migration is bounded and does not introduce destructive cascades or unrelated schema", () => {
  const sql = readFileSync(migrationPath, "utf8");
  assert.doesNotMatch(sql, /on delete cascade/i);
  assert.doesNotMatch(sql, /drop table|truncate table|supabase db push|supabase db reset/i);
  assert.match(sql, /alter function public\.api_complete_personal_weekly_report[^;]*owner to postgres/i);
  assert.match(sql, /alter function public\.api_reopen_personal_weekly_report[^;]*owner to postgres/i);
});

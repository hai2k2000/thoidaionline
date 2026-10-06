import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../../supabase/migrations/20261006130000_personal_weekly_reports.sql", import.meta.url),
  "utf8",
);

test("creates the employee period report table with bounded persistence constraints", () => {
  assert.match(migration, /create table public\.personal_weekly_reports/i);
  assert.match(migration, /employee_id uuid not null references public\.staff_users\(id\)/i);
  assert.match(migration, /department_id uuid not null references public\.departments\(id\)/i);
  assert.match(migration, /status text not null[^;]*check\s*\(status in \('DRAFT', 'COMPLETED'\)\)/is);
  assert.match(migration, /draft_payload jsonb/i);
  assert.match(migration, /snapshot_payload jsonb/i);
  assert.match(migration, /difficulties text/i);
  assert.match(migration, /unique\s*\(employee_id,\s*period_start,\s*period_end\)/i);
  assert.match(migration, /completed_at timestamptz/i);
  assert.match(migration, /status = 'COMPLETED'.*snapshot_payload is not null/is);
  assert.match(migration, /status = 'COMPLETED'.*completed_at is not null/is);
  assert.match(
    migration,
    /check\s*\(\s*extract\(\s*isodow\s+from\s+period_start\s*\)\s*=\s*5\s*and\s*period_end\s*=\s*period_start\s*\+\s*7\s*\)/is,
  );
  assert.match(migration, /create index[^;]*personal_weekly_reports[^;]*employee_id[^;]*period_start/is);
});

test("defines server-only actor-scoped save and completion RPCs", () => {
  assert.match(migration, /create or replace function public\.api_save_personal_weekly_report\([\s\S]*?p_difficulties text\s*\)/i);
  assert.match(migration, /create or replace function public\.api_complete_personal_weekly_report\([\s\S]*?p_difficulties text\s*\)/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /raise exception[^;]*ownership|raise exception[^;]*42501/is);
  assert.match(migration, /errcode\s*=\s*'42501'/i);
  assert.match(migration, /on conflict\s*\(employee_id,\s*period_start,\s*period_end\)/i);
  assert.match(migration, /for update/i);
  assert.match(migration, /if v_report\.status = 'COMPLETED'/i);
  assert.match(migration, /snapshot_payload.*difficulties/is);
  assert.match(migration, /revoke all on function public\.api_save_personal_weekly_report\([^;]+\) from public, anon, authenticated/i);
  assert.match(migration, /revoke all on function public\.api_complete_personal_weekly_report\([^;]+\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.api_save_personal_weekly_report\([^;]+\) to service_role/i);
  assert.match(migration, /grant execute on function public\.api_complete_personal_weekly_report\([^;]+\) to service_role/i);

  const saveBody = migration.match(
    /create or replace function public\.api_save_personal_weekly_report\([\s\S]*?\$\$;\s*/i,
  )?.[0] ?? "";
  const completionBody = migration.match(
    /create or replace function public\.api_complete_personal_weekly_report\([\s\S]*?\$\$;\s*/i,
  )?.[0] ?? "";
  for (const body of [saveBody, completionBody]) {
    assert.match(body, /extract\(\s*isodow\s+from\s+p_period_start\s*\)\s*<>\s*5/i);
    assert.match(body, /p_period_end\s*<>\s*p_period_start\s*\+\s*7/i);
  }
  assert.match(completionBody, /if not found then[\s\S]*raise exception[^;]*draft/i);
  assert.match(completionBody, /jsonb_set\([\s\S]*to_jsonb\(v_report\.difficulties\)/i);
  assert.match(completionBody, /coalesce\(v_report\.draft_payload,\s*'\{\}'::jsonb\)/i);
  assert.match(completionBody, /v_snapshot,\s*v_report\.difficulties,\s*now\(\),\s*now\(\)/i);
  assert.doesNotMatch(completionBody, /to_jsonb\(coalesce\(p_difficulties/i);
});

test("uses difficulties as the editable draft field and prevents completed row mutation", () => {
  assert.match(migration, /p_difficulties text/i);
  assert.match(migration, /difficulties\s*=\s*excluded\.difficulties/i);
  assert.match(migration, /jsonb_set\([^;]*difficulties/is);
  assert.match(migration, /create or replace function public\.personal_weekly_reports_immutable/i);
  assert.match(migration, /old\.status\s*=\s*'COMPLETED'/i);
  assert.match(migration, /before update or delete on public\.personal_weekly_reports/i);
  assert.match(migration, /raise exception[^;]*completed[^;]*42501/is);
});

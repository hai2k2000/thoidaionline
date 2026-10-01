import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../../supabase/migrations/20261001090000_quick_report_task_v1.sql", import.meta.url), "utf8");
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

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260918100000_journalism_tasks_j2_schema.sql",
);

test("J2 migration defines the approved additive tables without a task discriminator", () => {
  const sql = readFileSync(migrationPath, "utf8");
  for (const table of ["journalism_work_kinds", "journalism_task_details"]) {
    assert.match(sql, new RegExp(`create table(?: if not exists)? public\\.${table}`, "i"));
  }
  for (const forbidden of ["task_domain", "task_kind", "content_format", "source_contact_notes", "topic_id", "series_id", "related_task_id"]) {
    assert.doesNotMatch(sql, new RegExp(forbidden, "i"));
  }
  assert.doesNotMatch(sql, /on conflict\\s*\\(code\\)\\s*do update/i);
});

test("J2 migration rejects blank master-data values and seeds exactly ten rows", () => {
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(sql, /btrim\(code\)/i);
  assert.match(sql, /btrim\(name\)/i);
  assert.match(sql, /code\s*=\s*btrim\(code\)/i);
  assert.match(sql, /name\s*=\s*btrim\(name\)/i);
  const values = [...sql.matchAll(/\('([a-z][a-z0-9_]*)',\s*'[^']+',\s*(\d+)\)/g)];
  assert.equal(values.length, 10);
  assert.deepEqual(values.map(([, code, order]) => [code, Number(order)]), [
    ["news", 10], ["article", 20], ["interview", 30], ["reportage", 40],
    ["photo", 50], ["video", 60], ["event_coverage", 70], ["editing", 80],
    ["translation", 90], ["other", 100],
  ]);
});

test("J2 migration protects detail references and direct client access", () => {
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(sql, /references public\.tasks\(id\)\s+on delete cascade/i);
  assert.match(sql, /references public\.journalism_work_kinds\(id\)\s+on delete restrict/i);
  assert.match(sql, /alter table public\.journalism_work_kinds enable row level security/i);
  assert.match(sql, /alter table public\.journalism_task_details enable row level security/i);
  assert.match(sql, /revoke all on table public\.journalism_work_kinds from public, anon, authenticated/i);
  assert.match(sql, /revoke all on table public\.journalism_task_details from public, anon, authenticated/i);
  assert.match(sql, /grant select, insert, update, delete on table public\.journalism_work_kinds to service_role/i);
  assert.match(sql, /grant select, insert, update, delete on table public\.journalism_task_details to service_role/i);
});

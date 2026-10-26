import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

// Destination in repo: src/lib/anonAccessLockdown.test.mjs
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const migrationsDir = new URL("../../supabase/migrations/", import.meta.url);

test("C-01 lockdown revokes anon/authenticated access in schema public", () => {
  const migration = read("../../supabase/migrations/20261027090000_anon_access_lockdown.sql");
  assert.match(migration, /revoke all privileges on %s public\.%I from public, anon, authenticated/i);
  assert.match(migration, /revoke execute on function %s from public, anon, authenticated/i);
  for (const table of ["work_schedules", "task_completion_scores", "task_quick_report_idempotency", "db_record_code_counters"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  for (const table of ["employee_profiles", "official_documents", "document_assignments"]) {
    assert.match(migration, new RegExp(`drop policy if exists "public write ${table}"`, "i"));
  }
  assert.match(migration, /alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated/i);
  assert.match(migration, /raise exception 'C-01 lockdown incomplete/);
  assert.doesNotMatch(migration, /grant [^;]* to (anon|authenticated)/i);
});

test("C-01 storage lockdown closes the public task-files bucket", () => {
  const migration = read("../../supabase/migrations/20261027090100_storage_anon_lockdown.sql");
  assert.match(migration, /set public = false[\s\S]*where id = 'task-files'/i);
  assert.match(migration, /drop policy if exists "public write task-files" on storage\.objects/i);
  assert.match(migration, /revoke all privileges on table storage\.objects from anon, authenticated/i);
});

test("migrations after the lockdown never grant to anon or authenticated", () => {
  const later = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql") && name > "20261027090100").sort();
  for (const name of later) {
    const sql = readFileSync(new URL(name, migrationsDir), "utf8");
    assert.doesNotMatch(sql, /\bgrant\s[^;]*\bto\s[^;]*\b(anon|authenticated)\b/i, `${name} grants to anon/authenticated`);
    assert.doesNotMatch(sql, /\bcreate policy[^;]*\bto\s+(anon|authenticated|public)\b/i, `${name} adds a policy for anon/authenticated/public`);
  }
});

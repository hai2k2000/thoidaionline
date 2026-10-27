import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = "scripts/production/h03-apply";
const order = readFileSync(`${root}/order.txt`, "utf8").trim().split(/\r?\n/).filter(Boolean);
const forbidden = /20260827160000|20260829100000|20260829110000|20260826210000|20260918100000/;

test("H03 order contains exactly correctives plus approved Group A and B migrations", () => {
  assert.equal(order.length, 16);
  // The batch-table lockdown must run right after the migration that creates the table.
  assert.equal(order[order.indexOf("20260925110000_task_assignment_batch_idempotency.sql") + 2], "20261027120100_h03_batch_idempotency_lockdown.sql");
  assert.equal(order[0], "20261027120000_h03_corrective_partial_objects.sql");
  assert.equal(forbidden.test(order.join("\n")), false);
  for (const filename of order) assert.equal(existsSync(`supabase/migrations/${filename}`), true, filename);
  for (const filename of order) assert.equal(existsSync(`${root}/post/${filename}`), true, filename);
});

test("corrective migration is narrowly scoped and does not grant anon or public", () => {
  const sql = readFileSync("supabase/migrations/20261027120000_h03_corrective_partial_objects.sql", "utf8").toLowerCase();
  // J2 triggers exist on production (2026-10-27 recheck); the corrective must not recreate them.
  assert.doesNotMatch(sql, /journalism_work_kinds_set_updated_at/);
  assert.doesNotMatch(sql, /journalism_task_details_set_updated_at/);
  assert.match(sql, /audit_direct_assignment_start/);
  assert.doesNotMatch(sql, /grant\s+[^;]*\s+to\s+(?:anon|public)\b/);
});

test("rollback does not drop tables outside CREATE TABLE objects in the listed files", () => {
  const creates = new Set();
  for (const filename of order) {
    const sql = readFileSync(`supabase/migrations/${filename}`, "utf8");
    for (const match of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi)) creates.add(match[1].toLowerCase());
  }
  const rollback = readFileSync(`${root}/rollback.sql`, "utf8");
  for (const match of rollback.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi)) assert.equal(creates.has(match[1].toLowerCase()), true, match[1]);
});

test("rollback and absent cover every migration-created function name", () => {
  const names = new Set();
  for (const filename of order) {
    const sql = readFileSync(`supabase/migrations/${filename}`, "utf8");
    for (const match of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)/gi)) names.add(match[1].toLowerCase());
  }
  const rollback = readFileSync(`${root}/rollback.sql`, "utf8").toLowerCase();
  const absent = readFileSync(`${root}/absent.sql`, "utf8").toLowerCase();
  for (const name of names) {
    assert.match(rollback, new RegExp(`['\\"]${name}['\\"]`), name);
    assert.match(absent, new RegExp(`['\\"]${name}['\\"]`), name);
  }
  assert.doesNotMatch(rollback, /cascade/);
  assert.doesNotMatch(rollback, /touch_journalism_updated_at/);
});

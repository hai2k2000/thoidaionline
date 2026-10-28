import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const script = readFileSync(new URL('scripts/production/attendance-production-apply.sh', root), 'utf8');
const dryrun = readFileSync(new URL('scripts/production/attendance-v1-dryrun.sh', root), 'utf8');

const migrations = [
  '20261028150000_attendance_rbac_v1.sql',
  '20261028160000_attendance_late_exception_review.sql',
  '20261028170000_attendance_workday_adjustments.sql',
];
const reverts = [
  'attendance-workday-adjustments-revert.sql',
  'attendance-late-exception-review-revert.sql',
  'attendance-rbac-v1-revert.sql',
  "delete from supabase_migrations.schema_migrations where version in ('20261028150000','20261028160000','20261028170000')",
];

test('production apply is fail-closed and secret-free', () => {
  assert.match(script, /local mode=verify-only/);
  assert.match(script, /THOIDAI_ATTENDANCE_PROD_APPROVED.*APPROVE-ATTENDANCE-PRODUCTION/);
  assert.match(script, /ATTENDANCE_PROD_APPLY=VERIFY_ONLY_PASS/);
  assert.match(script, /ATTENDANCE_PROD_APPLY=FAIL step=/);
  assert.match(script, /MIGRATION_REFERENCE/);
  assert.match(script, /psql -q -h 127\.0\.0\.1 -U supabase_admin/);
  assert.doesNotMatch(script, /postgresql:\/\/[^\s"']*:[^@\s"']+@/);
  assert.doesNotMatch(script, /echo[^\n]*(password|DB_URL)/i);
});

test('migrations, backup, and revert instructions are ordered', () => {
  let cursor = -1;
  for (const migration of migrations) {
    const next = script.indexOf(migration, cursor + 1);
    assert.ok(next > cursor, `${migration} must appear in order`);
    cursor = next;
  }
  assert.ok(script.indexOf('step=backup') < script.indexOf('SAFE_MIGRATION_PSQL_BIN='));
  cursor = -1;
  for (const revert of reverts) {
    const next = script.indexOf(revert, cursor + 1);
    assert.ok(next > cursor, `${revert} must appear in revert order`);
    cursor = next;
  }
});

test('lockdown queries exactly match the validated dry-run queries', () => {
  const queries = [...dryrun.matchAll(/psql -q "\$ATTENDANCE_DB_URL" -At -c "(select count\(\*\) from [^"]+)"/g)]
    .map((match) => match[1])
    .filter((sql) => sql.includes('attendance_workday_adjustments') || sql.includes('api_request_late_exception'));
  assert.equal(queries.length, 3);
  for (const query of queries) assert.ok(script.includes(query), `missing lockdown query: ${query}`);
});

test('SQL strings passed to scalar and psql -c have balanced parentheses', () => {
  const sqlStrings = [
    ...script.matchAll(/scalar\s+(?:'([^']*)'|"((?:[^"\\]|\\.)*)")/g),
    ...script.matchAll(/(?:-c|--command)\s+(?:'([^']*)'|"((?:[^"\\]|\\.)*)")/g),
  ].map((match) => match[1] ?? match[2] ?? match[3] ?? match[4]);
  assert.ok(sqlStrings.length >= 10, `expected at least 10 SQL strings, found ${sqlStrings.length}`);
  for (const sql of sqlStrings) {
    let depth = 0;
    for (const char of sql.replace(/'[^']*'/g, "''")) {
      if (char === '(') depth += 1;
      if (char === ')') depth -= 1;
      assert.ok(depth >= 0, `unbalanced ')' in: ${sql.slice(0, 140)}`);
    }
    assert.equal(depth, 0, `unbalanced '(' in: ${sql.slice(0, 140)}`);
  }
});

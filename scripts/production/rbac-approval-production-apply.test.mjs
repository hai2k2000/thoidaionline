import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const script = readFileSync(new URL('scripts/production/rbac-approval-production-apply.sh', root), 'utf8');
const revert = readFileSync(new URL('scripts/production/rbac-approval-v1-revert.sql', root), 'utf8');

test('production apply script contains fail-closed migration and apply gates', () => {
  assert.match(script, /local mode=verify-only/);
  assert.match(script, /THOIDAI_RBAC_PROD_APPROVED.*APPROVE-RBAC-APPROVAL-PRODUCTION/);
  assert.match(script, /MIGRATION_REFERENCE/);
  assert.match(script, /RBAC_ALLOWED_MISSING/);
  for (const md5 of ['a68fcf7a399f8ffec851841bf2585b4f', '39b3913aca8268e85c5fdfd1d0226971', '869b5467706e36f844dcee79374bbd65']) {
    assert.match(script, new RegExp(md5));
  }
  assert.match(script, /systemctl start/);
  assert.match(script, /safe-apply-migration\.sh/);
  assert.ok(script.indexOf('step=backup') < script.indexOf('step=safe-apply'));
  assert.match(script, /RBAC_PROD_APPLY=FAIL step=/);
  assert.doesNotMatch(script, /docker\s+(inspect|top)/);
  assert.match(script, /psql -q/);
  assert.match(script, /main "\$@" <\/dev\/null/);
  assert.doesNotMatch(script, /auto.?revert|rbac-approval-v1-revert\.sql.*safe-apply/i);
});

test('revert script documents attendance-RBAC ordering', () => {
  assert.match(revert, /If the attendance-RBAC migrations \(PR #63; they redefine `rbac_v2_scope_supported` on top of this one\) are applied, run their revert FIRST, then this file\./);
  assert.match(revert, /This file restores the P1 production definition, which would otherwise drop attendance's scope branch\./);
});

test("production apply pins the exact P1 md5 values and uses the supabase_admin loopback path", () => {
  const script = readFileSync(new URL("./rbac-approval-production-apply.sh", import.meta.url), "utf8");
  for (const pair of [
    "api_review_leave_request|a68fcf7a399f8ffec851841bf2585b4f",
    "api_review_personal_work_schedule|39b3913aca8268e85c5fdfd1d0226971",
    "rbac_v2_scope_supported|869b5467706e36f844dcee79374bbd65",
  ]) assert.ok(script.includes(`'${pair}'`), `missing exact md5 ${pair}`);
  assert.match(script, /psql -q -h 127\.0\.0\.1 -U supabase_admin/);
  assert.doesNotMatch(script, /-U postgres\b/);
});

test("every SQL string in the production apply script has balanced parentheses", () => {
  // Regression: the role-grants post-check shipped with an extra ')' and failed on production (2026-10-28).
  const script = readFileSync(new URL("./rbac-approval-production-apply.sh", import.meta.url), "utf8");
  const sqlStrings = [
    ...script.matchAll(/(?:scalar|ro_sql) "((?:[^"\\]|\\.)*)"/g),
    ...script.matchAll(/(?:approval_codes|seeded_grant|approval_grants)="((?:[^"\\]|\\.)*)"/g),
  ].map((match) => match[1]);
  assert.ok(sqlStrings.length >= 10, `expected to find the SQL strings, found ${sqlStrings.length}`);
  for (const sql of sqlStrings) {
    let depth = 0;
    for (const char of sql.replace(/'[^']*'/g, "''")) {
      if (char === "(") depth += 1;
      if (char === ")") depth -= 1;
      assert.ok(depth >= 0, `unbalanced ')' in: ${sql.slice(0, 120)}`);
    }
    assert.equal(depth, 0, `unbalanced '(' in: ${sql.slice(0, 120)}`);
  }
});

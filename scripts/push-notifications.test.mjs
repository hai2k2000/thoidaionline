import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path, 'utf8');
test('push queue is additive, service-only, idempotent and uses bounded leased SKIP LOCKED claims', () => {
  const sql = read('supabase/migrations/20261107100000_push_notifications.sql');
  assert.match(sql, /create table if not exists public\.push_subscriptions/i);
  assert.match(sql, /mobile_push_tokens/);
  assert.match(sql, /revoke all.*from public,anon,authenticated/i);
  assert.doesNotMatch(sql, /grant .* to (?:anon|authenticated)/i);
  assert.match(sql, /for update skip locked\s+limit 50/i);
  assert.match(sql, /push_attempts\s*<\s*5/i);
  assert.match(sql, /interval '24 hours'/i);
  assert.match(sql, /push_claimed_at.*interval '5 minutes'/i);
  assert.match(sql, /after insert or update.*on public\.task_assignees/is);
  assert.match(sql, /new\.assignment_role.*'owner','assignee'/i);
  assert.match(sql, /exception when others then\s+raise warning/i);
  assert.match(sql, /recipient\s+is distinct from t\.created_by/i);
});

test('push dry-run restores a migration schema, validates data counts and reasserts ACLs', () => {
  const script = read('scripts/production/push-notifications-dryrun.sh');
  assert.match(script, /create schema if not exists supabase_migrations/i);
  assert.match(script, /pg_restore --schema=public --schema=supabase_migrations/);
  assert.doesNotMatch(script, /pg_restore .*--clean/);
  assert.doesNotMatch(script, /pg_restore .*--if-exists/);
  assert.match(script, /pg_restore[\s\S]*\|\| true/);
  assert.match(script, /count\(\*\) from public\.tasks[\s\S]*count\(\*\) from public\.staff_users[\s\S]*count\(\*\) from public\.task_assignees[\s\S]*count\(\*\) from supabase_migrations\.schema_migrations/i);
  assert.match(script, /step=restore_acl/);
  assert.match(script, /mobile_push_tokens/);
});
test('dispatcher startup is explicitly opt-in and excluded from production build', () => {
  const source = read('src/instrumentation.ts');
  assert.match(source, /NEXT_RUNTIME.*nodejs/);
  assert.match(source, /PUSH_DISPATCH_ENABLED.*1/);
  assert.match(source, /phase-production-build/);
});

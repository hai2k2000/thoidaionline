import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const migration = read('supabase/migrations/20261107120000_push_notifications_v2.sql');
const functionBody = (sql, name) => {
  const definition = sql.split(`create or replace function public.${name}(`)[1];
  assert.ok(definition, `Missing function ${name}`);
  return definition.split('as $function$')[1].split('$function$;')[0].trim();
};

test('every v2 helper is postgres-owned SECURITY DEFINER and closed to client roles', () => {
  for (const match of migration.matchAll(/create or replace function public\.(\w+)\(([^\n]*)\)/g)) {
    const definition = migration.slice(match.index).split('$function$;')[0];
    assert.match(definition, /security definer set search_path=public,pg_temp/i);
    assert.match(migration, new RegExp(`alter function public\\.${match[1]}\\([^;]+owner to postgres;`));
    assert.match(migration, new RegExp(`revoke all on function public\\.${match[1]}\\([^;]+from public,anon,authenticated,service_role;`));
  }
  assert.doesNotMatch(migration, /grant\s+[^;]+\bto\s+(?:public|anon|authenticated)\b/i);
  assert.match(migration, /primary key \(notification_id,subscription_id\)/);
  for (const kind of ['assignment', 'comment', 'status', 'department_collaboration']) {
    assert.match(functionBody(migration, `enqueue_${kind === 'department_collaboration' ? kind : `task_${kind}`}_notification`), /exception when others then[\s\S]*raise warning/);
  }
  assert.match(functionBody(migration, 'claim_push_notifications'), /public\.push_notification_visible\(pending\)/);
});

test('v2 rollback restores proven v1 functions and preserves delivery history', () => {
  const prior = read('supabase/migrations/20261107100000_push_notifications.sql');
  const revert = read('scripts/production/push-notifications-v2-revert.sql');
  for (const name of ['claim_push_notifications', 'enqueue_task_assignment_notification']) {
    assert.equal(functionBody(revert, name), functionBody(prior, name));
  }
  assert.doesNotMatch(revert, /(?:drop table|truncate|delete from)/i);
});

test('v2 rehearsal retains tolerant restore, count gates and ACL repair before apply', () => {
  const script = read('scripts/production/push-notifications-v2-dryrun.sh');
  assert.ok(script.indexOf('create schema if not exists supabase_migrations') < script.indexOf('pg_restore'));
  const restore = script.match(/pg_restore[\s\S]*?\|\| true/)?.[0];
  assert.ok(restore);
  assert.doesNotMatch(restore, /--clean|--exit-on-error|--if-exists/);
  assert.match(script, /restore_counts[\s\S]*count\(\*\) from public\.tasks[\s\S]*count\(\*\) from supabase_migrations\.schema_migrations/);
  assert.ok(script.indexOf('step=restore_acl') < script.indexOf('step=apply'));
  assert.match(script, /'notification_deliveries'/);
  const behaviour = read('supabase/tests/push_notifications_v2_behaviour.sql');
  assert.match(behaviour, /begin;/);
  assert.match(behaviour, /rollback;\s*$/);
  assert.match(behaviour, /job_title_id/);
  assert.doesNotMatch(behaviour, /update public\.departments set manager_id/i);
});

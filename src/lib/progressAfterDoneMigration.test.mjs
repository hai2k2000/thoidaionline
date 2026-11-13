import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { classifyTransactionSafety } from '../../scripts/production/safe-apply-migration.mjs';
const read = p => readFileSync(p, 'utf8').replaceAll('\r\n', '\n');
const path = 'supabase/migrations/20261113100000_progress_report_after_done.sql';
const migration = read(path);
const name = 'api_submit_task_progress_report';
const extract = sql => sql.match(/create or replace function public\.api_submit_task_progress_report\([\s\S]*?\$function\$;/)?.[0];
const oldFiles = readdirSync('supabase/migrations').filter(p => p < '20261113100000' && p.endsWith('.sql')).sort().filter(p => extract(read('supabase/migrations/' + p)));
const old = extract(read('supabase/migrations/' + oldFiles.at(-1)));
test('RPC changes only acceptance and transition status gates; revert is exact', () => {
  assert.equal(extract(migration), old.replace("v_before.status in ('pending_review','done','cancelled')", "v_before.status='cancelled'").replace("case when p_report_status in ('blocked','waiting')", "case when v_before.status in ('pending_review','done') then v_before.status when p_report_status in ('blocked','waiting')"));
  assert.equal(extract(read('scripts/production/progress-after-done-revert.sql')), old);
  assert.deepEqual(classifyTransactionSafety(migration), { safe: true, blockers: [] });
});
test('migration and revert retain service-only execution and owner', () => {
  for (const sql of [migration, read('scripts/production/progress-after-done-revert.sql')]) {
    assert.ok(sql.includes('revoke all on function public.' + name + '(uuid,uuid,date,text,text,text) from public,anon,authenticated;'));
    assert.ok(sql.includes('grant execute on function public.' + name + '(uuid,uuid,date,text,text,text) to service_role;'));
    assert.ok(sql.includes('alter function public.' + name + '(uuid,uuid,date,text,text,text) owner to postgres;'));
    assert.ok(sql.includes("notify pgrst, 'reload schema'"));
  }
});
test('safe-apply postcondition is SQL only and returns pass after security and state checks', () => {
  const sql = read('scripts/production/progress-after-done-post.sql');
  assert.doesNotMatch(sql, /^\\/m);
  assert.match(sql, /has_function_privilege/);
  assert.match(sql, /prosecdef/);
  assert.match(sql, /then 'pass' else 'fail' end/);
});

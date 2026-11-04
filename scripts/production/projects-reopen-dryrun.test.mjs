import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
const read = p => existsSync(p) ? readFileSync(p, 'utf8') : '';
test('disposable reopen rehearsal restores, applies, tests, reverts and reapplies with safety guards', () => {
  const script = read('scripts/production/projects-reopen-dryrun.sh');
  for (const pattern of [/THOIDAI_PROJECTS_REOPEN_DRYRUN_APPROVED/, /disk_guard_require/, /sha256sum/, /127\.0\.0\.1::5432/, /step=restore/, /step=apply/, /step=behaviour/, /step=revert/, /step=reapply/, /projects_reopen_behaviour\.sql/, /safe-apply-migration\.sh/, /20261105100000/, /to_regprocedure\('public.api_reopen_project\(uuid,uuid\)'\) is null/]) assert.match(script, pattern);
  const revert = read('scripts/production/projects-reopen-revert.sql');
  assert.match(revert, /drop function if exists public.api_reopen_project\(uuid,uuid\)/);
  assert.match(revert, /ledger/i);
  assert.doesNotMatch(revert, /drop table|delete from|update public\.projects/i);
  const post = read('scripts/production/projects-reopen/post/20261105100000_projects_reopen.sql');
  for (const pattern of [/prosecdef/, /proconfig/, /aclexplode/, /has_function_privilege\('anon'/, /has_function_privilege\('authenticated'/, /has_function_privilege\('service_role'/, /'pass' else 'fail'/]) assert.match(post, pattern);
});
test('SQL behavior fixtures exercise roles, state, assignment and audit in a rollback transaction', () => {
  const sql = read('supabase/tests/projects_reopen_behaviour.sql');
  for (const pattern of [/begin;/, /rollback;/, /api_close_project/, /api_reopen_project/, /api_assign_project_task/, /'42501'/, /'55000'/, /'P0002'/, /deputy/, /member/, /outsider/, /cong_tac_vien/, /nonmember/, /action='reopen'/]) assert.match(sql, pattern);
});

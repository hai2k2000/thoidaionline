import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
const read = p => existsSync(p) ? readFileSync(p, 'utf8') : '';
const root = 'scripts/production/';
test('task assignment rehearsal preserves disposable restore safety', () => {
  const s = read(root + 'task-assignment-dryrun.sh');
  for (const p of [/THOIDAI_TASK_ASSIGNMENT_DRYRUN_APPROVED/, /BUNDLE_DIR/, /POSTGRES_IMAGE/, /disk_guard_require/, /sha256sum/, /trap cleanup EXIT/, /trap 'exit 130' INT/, /trap 'exit 143' TERM/, /task-assignment-dryrun-\$\$/, /leftover dry-run container/, /127\.0\.0\.1::5432/, /--schema=public --schema=supabase_migrations/, /step=restore_acl/, /task-assignment-evidence/, /TASK_ASSIGNMENT_DRYRUN_RESULT=FAIL step=/, /TASK_ASSIGNMENT_DRYRUN_RESULT=PASS step=/]) assert.match(s, p);
  assert.ok(s.indexOf('leftover dry-run container') < s.indexOf('tmp="$candidate"'));
  assert.match(s, /set \+x/);
  assert.doesNotMatch(s, /do \$ declare|end \$;|\\r\\nSQL/);
  assert.doesNotMatch(s, /set -x|echo.*(?:db_password|DB_URL|PGPASSWORD)|psql[^\n]*"\$TASK_ASSIGNMENT_DB_URL"|systemctl|docker (?:system|volume) prune/);
});
test('ordered migrations, prerequisite, ledger, behaviour and replay are wired', () => {
  const s = read(root + 'task-assignment-dryrun.sh');
  for (const p of [/safe-apply-migration\.sh/, /20261105100000_projects_reopen/, /where version='20261105100000'/, /20261105140000_task_assignment_optional_deadline/, /20261105150000_task_assignment_on_behalf/, /task-assignment\/post/, /step=behaviour/, /task_assignment_behaviour\.sql/, /step=idempotency/, /before.*after/s, /schema_migrations/]) assert.match(s, p);
  assert.ok(s.indexOf('20261105140000_task_assignment_optional_deadline') < s.indexOf('20261105150000_task_assignment_on_behalf'));
  assert.doesNotMatch(s, /pg_get_functiondef/);
});
test('postconditions verify exact signatures and grants, entered_by foreign key and removed overloads', () => {
  for (const file of ['20261105140000_task_assignment_optional_deadline', '20261105150000_task_assignment_on_behalf']) {
    const s = read(root + 'task-assignment/post/' + file + '.sql');
    for (const p of [/to_regprocedure/, /prosecdef/, /proowner/, /postgres/, /aclexplode/, /has_function_privilege\('anon'/, /has_function_privilege\('authenticated'/, /has_function_privilege\('service_role'/, /'pass' else 'fail'/]) assert.match(s, p);
    assert.doesNotMatch(s, /pg_get_functiondef/);
  }
  const s = read(root + 'task-assignment/post/20261105150000_task_assignment_on_behalf.sql');
  for (const p of [/entered_by/, /pg_constraint/, /confrelid/, /is null/]) assert.match(s, p);
});
test('behaviour uses restored fixtures and rollback with SQLSTATE and data assertions', () => {
  const s = read('supabase/tests/task_assignment_behaviour.sql');
  for (const p of [/begin;/, /set local/, /rollback;/, /tong_bien_tap/, /truong_phong/, /api_assign_task_v2/, /api_assign_task_batch_v1/, /api_assign_project_task/, /api_change_assigned_task_deadline/, /'22023'/, /'42501'/, /replayed/, /task_deadline_history/, /audit_logs/, /entered_by/, /raise exception/i, /raise notice/i]) assert.match(s, p);
  assert.doesNotMatch(s, /pg_get_functiondef|insert into public.staff_users/i);
});

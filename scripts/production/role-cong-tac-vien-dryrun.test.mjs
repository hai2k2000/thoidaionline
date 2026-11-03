import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : '';
const script = read('scripts/production/role-cong-tac-vien-dryrun.sh');
const post = read('scripts/production/role-cong-tac-vien/post/20261103150000_role_cong_tac_vien.sql');
const behaviour = read('supabase/tests/role_cong_tac_vien_behaviour.sql');

test('dry-run guards and isolates the disposable database', () => {
  assert.match(script, /THOIDAI_ROLE_CTV_DRYRUN_APPROVED:-0.*== 1/);
  for (const text of ['disk-guard.sh', 'trap cleanup EXIT', 'docker ps -a', 'role-ctv-dryrun-', '127.0.0.1::5432', '--memory 512m', 'main "$@" </dev/null', '/opt/ops/thoidai-work/role-ctv-evidence/role-ctv-']) assert.ok(script.includes(text), text);
  assert.doesNotMatch(script, /PROJECTS|projects-v1|systemctl|set -x/);
  assert.ok(!existsSync('scripts/production/_template-projects-dryrun.sh'));
});

test('restore keeps the proven schema restore and error excerpt checks', () => {
  assert.match(script, /pg_restore --schema=public --schema=supabase_migrations/);
  assert.match(script, /restore\.log" 2>&1 \|\| true/);
  assert.match(script, /sha256sum "\$dump"/);
  for (const table of ['tasks', 'staff_users', 'departments', 'supabase_migrations.schema_migrations']) assert.ok(script.includes(`count(*) from ${table.includes('.') ? table : `public.${table}`}`));
  assert.match(script, /tail -n 20 "\$work\/restore.log" \| grep 'ERROR'/);
  assert.match(script, /ERROR\|CONTEXT\|DETAIL\|HINT\|LINE\|psql:/);
  assert.match(script, /head -20 \| tee "\$evidence\/behaviour-error.txt"/);
});

test('all lifecycle stages run in order and only the CTV ledger is removed', () => {
  let previous = -1;
  for (const stage of ['restore', 'apply', 'behaviour', 'idempotency', 'revert', 'reapply', 'complete']) {
    const index = script.indexOf(`step=${stage}`);
    assert.ok(index > previous, stage); previous = index;
  }
  assert.match(script, /--db-url-env ROLE_CTV_DB_URL --postcondition-sql "\$post"/);
  assert.match(script, /psql -X -v ON_ERROR_STOP=1 -f "\$migration"/);
  assert.match(script, /\[\[ "\$before" == "\$after" \]\]/);
  assert.match(script, /delete from supabase_migrations.schema_migrations where version='20261103150000'/);
  for (const table of ['roles', 'role_permissions', 'role_permission_grants']) assert.ok(script.includes(`not exists(select 1 from public.${table}`));
  assert.match(script, /ROLE_CTV_DRYRUN_RESULT=PASS/);
  assert.match(script, /ROLE_CTV_DRYRUN_RESULT=FAIL step=\$step/);
});

test('postcondition and behaviour reject missing, extra and broad grants', () => {
  for (const sql of [post, behaviour]) {
    for (const text of ['task.view', 'task.comment', 'assigned', 'cong_tac_vien', 'can_comment', 'can_manage_users', 'can_manage_permissions', 'can_create_task', 'can_edit_all_tasks', 'can_assign_task', 'can_view_department_tasks', 'can_evaluate_step1', 'can_evaluate_step2', 'can_manage_rubrics']) assert.ok(sql.includes(text), text);
    assert.match(sql, /count\(\*\)[\s\S]*?= 2/);
    assert.match(sql, /level = 1/);
    assert.match(sql, /active is true/);
    assert.match(sql, /not exists/i);
  }
  assert.match(post, /then 'pass' else 'fail' end/);
  assert.match(behaviour, /scope in \('organization', 'department', 'all'\)/);
});

test('behaviour executes the actual revert inside a recoverable fixture', () => {
  assert.match(behaviour.trim(), /^begin;/);
  assert.match(behaviour.trim(), /rollback;$/);
  assert.match(behaviour, /savepoint role_ctv_assignment/);
  assert.match(behaviour, /rollback to savepoint role_ctv_assignment/);
  assert.match(behaviour, /update public.staff_users set role_id/);
  assert.match(behaviour, /execute current_setting\('role_ctv.revert_sql'\)/);
  assert.match(behaviour, /sqlerrm <> 'Cannot revert cong_tac_vien while staff_users still reference this role'/);
  assert.match(behaviour, /if not refused then/);
  assert.match(script, /-v revert_sql="\$revert_body"/);
  assert.match(script, /sed '1d;\$d' "\$revert"/);
});

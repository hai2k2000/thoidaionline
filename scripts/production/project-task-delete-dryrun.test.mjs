import assert from 'node:assert/strict'; import test from 'node:test'; import { readFileSync } from 'node:fs';
test('project task delete dry-run keeps approval, disk, leftover and postcondition gates',()=>{const s=readFileSync('scripts/production/project-task-delete-dryrun.sh','utf8');for(const token of ['THOIDAI_PROJECT_TASK_DELETE_DRYRUN_APPROVED','BUNDLE_DIR','POSTGRES_IMAGE','disk_guard_require','leftover dry-run container','project-task-delete/post','trap cleanup EXIT','sha256sum'])assert.match(s,new RegExp(token));});
test('rehearsal restores a verified backup into a disposable local container and applies only this migration', () => {
  const s=readFileSync('scripts/production/project-task-delete-dryrun.sh','utf8');
  for(const token of ['127.0.0.1::5432','--schema=public --schema=supabase_migrations','step=restore_acl','safe-apply-migration.sh','project_cancelled_task_delete_behaviour.sql','step=idempotency','schema_migrations','project-task-delete-evidence'])assert.ok(s.includes(token),token);
  assert.ok(s.indexOf('leftover dry-run container')<s.indexOf('tmp="$candidate"'));
  assert.deepEqual([...new Set([...s.matchAll(/\d{14}_[\w]+\.sql/g)].map(m=>m[0]))],['20261105200000_project_cancelled_task_delete.sql']);
  assert.doesNotMatch(s,/systemctl|set -x|echo.*(?:db_password|DB_URL|PGPASSWORD)|docker (?:system|volume) prune/);
});
test('postcondition checks signature, definer, owner, search path and service-only ACL', () => {
  const s=readFileSync('scripts/production/project-task-delete/post/20261105200000_project_cancelled_task_delete.sql','utf8');
  for(const token of ['to_regprocedure','prosecdef','proowner','postgres','aclexplode','search_path=public, pg_temp',"has_function_privilege('anon'","has_function_privilege('authenticated'","has_function_privilege('service_role'","then 'pass' else 'fail'"])assert.ok(s.includes(token),token);
});
test('behaviour fixtures raise on failed assertions and cover permissions, atomicity, audit, storage and closed-plan detach', () => {
 const s=readFileSync('supabase/tests/project_cancelled_task_delete_behaviour.sql','utf8');
 for(const token of ['begin;','rollback;','raise exception','lead_id','member_id','deputy_id','inactive_id','foreign_task.id','active_task.id','Mixed batch was not atomic','task_comments','task_attachments','task_status_events','task_progress_reports','task_deadline_history','audit_logs','Historical plan changed','storage_paths',"'42501'","'22023'","'55000'"])assert.ok(s.includes(token),token);
 assert.doesNotMatch(s,/raise notice.*SKIP/);
});

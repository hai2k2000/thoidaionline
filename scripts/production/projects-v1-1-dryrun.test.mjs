import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const script=read('scripts/production/projects-v1-1-dryrun.sh');
const sql=read('supabase/migrations/20261103180000_projects_v1_1_deputy_library.sql');
const post=read('scripts/production/projects-v1-1/post/20261103180000_projects_v1_1_deputy_library.sql');
const revert=read('scripts/production/projects-v1-1-revert.sql');
const behaviour=read('supabase/tests/projects_v1_1_behaviour.sql');
test('V1.1 dryrun retains approval, disk, verified backup, disposable container and cleanup gates',()=>{
 for(const token of ['THOIDAI_PROJECTS_V11_DRYRUN_APPROVED','disk-guard.sh','sha256sum','trap cleanup EXIT','127.0.0.1::5432','--memory 512m','leftover dry-run container','main "$@" </dev/null'])assert.ok(script.includes(token),token);
 assert.doesNotMatch(script,/systemctl|supabase_db_thoidai-work/);
});
test('V1.1 dryrun applies exact migration, behaviour, postcondition, revert and reapply',()=>{
 for(const token of ['20261103180000_projects_v1_1_deputy_library.sql','projects_v1_1_behaviour.sql','projects-v1-1-revert.sql','step=idempotency','step=reapply','safe-apply-migration.sh','ON_ERROR_STOP=1',"version='20261103180000'"])assert.ok(script.includes(token),token);
 assert.match(script,/PROJECTS_V11_RESTORE_ACL=REASSERTED/);
 assert.match(script,/revoke all on table public\.projects,public\.project_members from public,anon,authenticated/);
 assert.match(script,/grant all on table public\.projects,public\.project_members to service_role;/);
 assert.ok(script.indexOf('PROJECTS_V11_RESTORE=PASS') < script.indexOf('step=restore_acl'));
 assert.match(script,/step=restore_acl\s+psql -X -v ON_ERROR_STOP=1 -q[^\n]*<<'SQL'\nrevoke all[^\n]*\ngrant all[^\n]*\nSQL\s+echo PROJECTS_V11_RESTORE_ACL=REASSERTED/);
 assert.ok(script.indexOf('PROJECTS_V11_RESTORE_ACL=REASSERTED') < script.indexOf('step=apply; apply_projects'));
 assert.match(behaviour,/foreach tab in array array\['projects','project_members','project_library_folders','project_library_items'\] loop/);
 assert.match(behaviour,/has_table_privilege\(role_name,'public\.'\|\|tab,'SELECT,INSERT,UPDATE,DELETE'\)/);
 assert.match(post,/'pass'/);assert.match(post,/relrowsecurity/);assert.match(post,/pg_policies/);
});
test('revert preserves V1 and refuses loss of manual content',()=>{
 assert.match(revert,/raise exception.*manual library content/);
 assert.match(revert,/update public.project_members set role='member' where role='deputy'/);
 assert.doesNotMatch(revert,/drop table public\.(projects|project_members|tasks);/);
 assert.match(revert,/create or replace function public.api_assign_project_task/);
});
test('migration and behavioural fixture are transactional and retain real schema fixture constraints',()=>{
 assert.match(sql,/begin;/);assert.match(sql,/commit;/);
 assert.match(behaviour,/begin;/);assert.match(behaviour,/rollback;\s*$/);
 assert.match(behaviour,/on conflict \(task_id\) do update/);
 assert.match(behaviour,/insert into public.job_titles/);
 assert.match(behaviour,/staff insertion synchronizes manager_id/i);
 for(const token of ['deputy','api_get_project_library_file','api_mutate_project_library_folder','source_attachment_id','cong_tac_vien'])assert.ok(behaviour.includes(token));
 assert.match(sql,/revoke all on table public\.project_library_folders,public\.project_library_items from public,anon,authenticated/);
 assert.match(sql,/revoke all on function %s from public,anon,authenticated/);
});

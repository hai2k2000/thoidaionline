import assert from 'node:assert/strict'; import test from 'node:test'; import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8'); const sql=read('supabase/migrations/20261103200000_projects_v1_2_permissions.sql'); const script=read('scripts/production/projects-v1-2-dryrun.sh'); const post=read('scripts/production/projects-v1-2/post/20261103200000_projects_v1_2_permissions.sql');
test('V1.2 migration hardens project permissions',()=>{ for(const token of ['project.create','api_transfer_project_lead','cong_tac_vien','api_project_is_lead','revoke all on function']) assert.ok(sql.includes(token),token); assert.match(sql,/begin;[\s\S]*commit;/); });
test('V1.2 dry-run keeps backup, disk and ACL restore gates',()=>{ for(const token of ['THOIDAI_PROJECTS_V12_DRYRUN_APPROVED','disk-guard.sh','sha256sum','restore_acl','REASSERTED','safe-apply-migration.sh','step=reapply']) assert.ok(script.includes(token),token); });
test('V1.2 postcondition locks execute ACLs',()=>{ assert.match(post,/relrowsecurity/); assert.match(post,/public.api_transfer_project_lead/); assert.match(post,/service_role/); });

test('every V1.2 function has exact explicit service-only execute ACLs',()=>{
 const signatures=['validate_task_report_recipient()','api_approve_task_claim(uuid,uuid,text,text)','api_review_assigned_task_completion(uuid,uuid,text,text)','api_project_actor_can_create(uuid)','api_project_is_lead(uuid,uuid)','api_project_can_assign(uuid,uuid)','api_create_project(uuid,text,text,text,uuid,uuid[])','api_assert_project_library(uuid,uuid,boolean)','rbac_v2_scope_supported(text,text)','api_set_user_permission_override(uuid,uuid,text,text,text)','api_list_user_approval_permissions(uuid,uuid)','api_transfer_project_lead(uuid,uuid,uuid,text)','api_assign_project_task(uuid,uuid,text,text,uuid,uuid,date,time,text,uuid[],uuid[],text,text)'];
 assert.equal([...sql.matchAll(/create or replace function/gi)].length,signatures.length);
 for(const sig of signatures){assert.ok(sql.includes(`revoke all on function public.${sig} from public,anon,authenticated;`),sig);assert.ok(sql.includes(`grant execute on function public.${sig} to service_role;`),sig);}
 assert.doesNotMatch(sql,/create policy/i);
});
test('transfer is serialized and validates active non-CTV membership and actor demotion',()=>{
 const transfer=sql.slice(sql.indexOf('create or replace function public.api_transfer_project_lead'));
 for(const token of ['for update','api_project_is_lead(p_actor_id,p_project_id)',"r.code<>'cong_tac_vien'","p_actor_role not in ('lead','deputy','member')","role='lead'","'transfer_lead'"]) assert.ok(transfer.includes(token),token);
 assert.ok(transfer.indexOf("set role='lead'")<transfer.indexOf('set role=p_actor_role'));
});
test('dry-run reasserts V1.1 library ACLs and preserves data on revert',()=>{
 for(const name of ['project_library_folders','project_library_items','api_project_can_assign','guard_project_staff_role','file_project_task_attachment'])assert.ok(script.includes(name),name);
 const revert=read('scripts/production/projects-v1-2-revert.sql');assert.doesNotMatch(revert,/drop table|delete from public\.(projects|project_members|project_library)/i);assert.match(revert,/drop function if exists public.api_transfer_project_lead/);
 const behaviour=read('supabase/tests/projects_v1_2_behaviour.sql');assert.match(behaviour,/rollback;\s*$/);assert.match(behaviour,/on conflict \(task_id\) do update/);
});

test('revert restores exact previous recipient and approval function definitions',()=>{
 const revert=read('scripts/production/projects-v1-2-revert.sql');
 for(const [file,names] of [
  ['20260820090000_task_assignment_reviewer_daily_due_time.sql',['validate_task_report_recipient']],
  ['20260924120000_task_approval_gates.sql',['api_approve_task_claim','api_review_assigned_task_completion']],
 ]) for(const name of names){
  const previous=read(`supabase/migrations/${file}`).match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$function\\$;`))[0];
  assert.ok(revert.includes(previous),`${name} exact restore`);
  assert.ok(sql.includes(`create or replace function public.${name}(`),`${name} replacement`);
  assert.ok(post.includes(`public.${name}(`),`${name} postcondition`);
 }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, existsSync} from 'node:fs';
import {canTaskAction} from './authorization.ts';
import {normalizePermissions} from './permissions.ts';
import {isCollaboratorAllowedPath} from './collaboratorRole.mjs';
const read=p=>readFileSync(p,'utf8');
test('every V1.1 RPC and trigger has an explicit service-only ACL and postcondition',()=>{
 const sql=read('supabase/migrations/20261103180000_projects_v1_1_deputy_library.sql');
 const post=read('scripts/production/projects-v1-1/post/20261103180000_projects_v1_1_deputy_library.sql');
 const signatures=['api_set_project_member(uuid,uuid,uuid,text,boolean)','api_assign_project_task(uuid,uuid,text,text,uuid,uuid,date,time,text,uuid[],uuid[],text,text)','api_project_can_assign(uuid,uuid)','guard_project_lead_role()','guard_project_staff_role()','api_assert_project_library(uuid,uuid,boolean)','ensure_project_task_folder(uuid,uuid)','create_project_task_folder()','api_list_project_library(uuid,uuid,uuid)','api_create_project_library_folder(uuid,uuid,text,uuid)','api_mutate_project_library_folder(uuid,uuid,uuid,text,text,uuid)','api_add_project_library_item(uuid,uuid,uuid,text,text,text,text,text,text,text,bigint)','api_mutate_project_library_item(uuid,uuid,uuid,text,text,uuid)','api_get_project_library_file(uuid,uuid,uuid)','file_project_task_attachment()'];
 for(const signature of signatures){
  assert.match(sql,new RegExp(`revoke all on function public\\.${signature.replace(/[()[\],]/g,'\\$&')} from public,anon,authenticated;`),signature);
  assert.ok(post.includes(`'public.${signature}'`),`postcondition missing ${signature}`);
 }
 assert.match(post,/p\.oid is null/); assert.match(post,/aclexplode/); assert.match(post,/acl\.grantee=0/);
 for(const role of ['anon','authenticated','service_role']) assert.ok(post.includes(`has_function_privilege('${role}',p.oid,'EXECUTE')`));
});
test('deputy assigns project tasks but cannot review',()=>{
 const actor={id:'deputy',roleCode:'nhan_vien',departmentId:null,permissions:normalizePermissions({})};
 const task={id:'task',projectId:'project',projectMembers:[{userId:'deputy',role:'deputy'}],participants:[]};
 assert.equal(canTaskAction(actor,task,'assign'),true);
 assert.equal(canTaskAction(actor,task,'review'),false);
 assert.equal(canTaskAction({...actor,roleCode:'cong_tac_vien'},task,'assign'),false);
});
test('library collaborator allowlist is scoped to project UUIDs and supported methods',()=>{
 const p='/api/projects/00000000-0000-4000-8000-000000000001/library';
 for(const method of ['GET','POST','PATCH','DELETE']) assert.equal(isCollaboratorAllowedPath(p,method),true);
 assert.equal(isCollaboratorAllowedPath(p,'PUT'),false);
 assert.equal(isCollaboratorAllowedPath('/api/projects/options','POST'),false);
});
test('single library migration includes secured hierarchy, filing and audit',()=>{
 const p='supabase/migrations/20261103180000_projects_v1_1_deputy_library.sql';
 assert.ok(existsSync(p)); const sql=read(p);
 for(const token of ['project_library_folders','project_library_items','task_files','task_attachments','security definer','audit_logs','deleted_at','source_attachment_id','enable row level security']) assert.ok(sql.includes(token),token);
 assert.doesNotMatch(sql,/create\s+policy/i);
});
test('library UI and migration shipping are integrated',()=>{
 assert.ok(existsSync('src/components/ProjectLibrary.tsx'));
 const ui=read('src/components/ProjectLibrary.tsx');
 for(const text of ['Thư viện','Thư mục mới','Thêm link','Tải tệp lên','breadcrumb','multiple']) assert.ok(ui.includes(text),text);
 for(const path of ['scripts/package-standalone.mjs','scripts/verify-standalone-artifact.mjs']) assert.ok(read(path).includes('20261103180000_projects_v1_1_deputy_library.sql'));
});

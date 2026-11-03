import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, existsSync} from 'node:fs';
import {canTaskAction} from './authorization.ts';
import {normalizePermissions} from './permissions.ts';
import {isCollaboratorAllowedPath} from './collaboratorRole.mjs';
const read=p=>readFileSync(p,'utf8');
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

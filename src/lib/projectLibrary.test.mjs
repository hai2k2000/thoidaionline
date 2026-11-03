import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {canChangeLibraryFolder,canChangeLibraryItem} from './projectLibrary.ts';
import {taskAttachmentMetadata,TASK_ATTACHMENT_MAX_BYTES} from './taskAttachmentPolicy.mjs';
import {can} from './rbac/authorization.ts';
const read=p=>readFileSync(p,'utf8');
async function load(path,deps){const source=read(path).replace(/import "server-only";/g,'').replace(/import type[^;]+;/g,'').replace(/import \{([^}]+)\} from [^;]+;/g,(_,names)=>`const {${names}}=globalThis.__libraryDeps;`);globalThis.__libraryDeps=deps;const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}#${Math.random()}`);}
test('library permissions enforce own content and automatic item protection',()=>{
 for(const manager of [false,true]){
  assert.equal(canChangeLibraryItem('actor',manager,{uploaded_by:'actor',source:'manual'},'delete'),true);
  assert.equal(canChangeLibraryItem('actor',manager,{uploaded_by:'other',source:'manual'},'delete'),manager);
  assert.equal(canChangeLibraryItem('actor',manager,{uploaded_by:'actor',source:'task_attachment'},'delete'),false);
  assert.equal(canChangeLibraryItem('actor',manager,{uploaded_by:'actor',source:'completion'},'move'),manager);
  assert.equal(canChangeLibraryFolder('actor',manager,{created_by:'actor',system_key:'task_files'}),false);
  assert.equal(canChangeLibraryFolder('actor',manager,{created_by:'other',system_key:null}),manager);
 }
});
test('shared upload limits accept fallback MIME and reject oversized and unsupported files',()=>{
 assert.equal(TASK_ATTACHMENT_MAX_BYTES,10485760);
 assert.deepEqual(taskAttachmentMetadata(new File(['abc'],'report.PDF')),{mimeType:'application/pdf',extension:'pdf'});
 assert.equal(taskAttachmentMetadata(new File([],'empty.pdf')),null);
 assert.equal(taskAttachmentMetadata(new File(['x'],'bad.exe')),null);
 assert.equal(taskAttachmentMetadata(new File([new Uint8Array(TASK_ATTACHMENT_MAX_BYTES+1)],'huge.pdf')),null);
});
test('RBAC project assignment accepts deputies while review stays lead-only',()=>{
 const actor={id:'deputy',departmentId:null,grants:[{permissionCode:'task.review',scope:'all'}]};
 const resource={kind:'task',projectId:'p',projectDeputyIds:['deputy'],projectLeadIds:['lead']};
 assert.equal(can(actor,'task.assign',resource),true);assert.equal(can(actor,'task.review',resource),false);
 assert.equal(can({...actor,id:'lead'},'task.review',resource),true);
});
test('library repository binds actor and project to every mutation and download',async()=>{
 const calls=[];const {projectLibraryRepository:r}=await load('src/lib/projectLibraryRepository.ts',{serverSupabase:{rpc:async(name,args)=>{calls.push([name,args]);return {data:{id:'result'},error:null};}}});
 await r.list('actor','p','folder');await r.createFolder('actor','p','Name',null);await r.addItem('actor','p',{kind:'link',title:'Link',folderId:null,url:'https://example.test'});await r.mutateFolder('actor','p','folder','move',null,'destination');await r.mutateItem('actor','p','item','delete',null,null);await r.file('actor','p','item');
 for(const [,args]of calls){assert.equal(args.p_actor_id,'actor');assert.equal(args.p_project_id,'p');}
 assert.equal(calls[0][1].p_folder_id,'folder');assert.equal(calls[3][1].p_parent_id,'destination');assert.equal(calls[5][0],'api_get_project_library_file');
});
test('deputy guard excludes collaborators and inactive deputies',async()=>{
 for(const [role,active,expected]of [['nhan_vien',true,null],['cong_tac_vien',true,403],['nhan_vien',false,403]]){
 const g=await load('src/lib/projectApiGuards.ts',{apiError:(_,status)=>new Response(null,{status}),rpcFailure:()=>new Response(null,{status:500}),projectRepository:{listMembers:async()=>({ok:true,data:[{user_id:'actor',role:'deputy',staff_users:{active}}]})}});
 const result=await g.requireProjectLeadOrDeputy({id:'actor',role_code:role},'p');assert.equal(result?.status??null,expected);
 }
});
test('library source integrates safe download, upload cleanup, mobile tree, breadcrumb and protected actions',()=>{
 const api=read('src/app/api/projects/[id]/library/route.ts');const ui=read('src/components/ProjectLibrary.tsx');const download=read('src/app/api/projects/[id]/library/download/[itemId]/route.ts');
 assert.ok(api.indexOf('listMembers')<api.indexOf('storage.upload'));assert.match(api,/storage.remove\(\[storagePath\]\)/);
 assert.ok(download.indexOf('projectLibraryRepository.file')<download.indexOf('createSignedUrl'));assert.match(download,/createSignedUrl\(item.data.storage_path,60/);
 for(const token of ['multiple','breadcrumb','lg:hidden','lg:block','canChangeLibraryItem','canChangeLibraryFolder','source_task_id','uploaded_by_name','Suspense'])assert.ok(ui.includes(token),token);
 assert.match(read('src/app/projects/[id]/page.tsx'),/<Suspense[\s\S]*ProjectDetailShell/);
});

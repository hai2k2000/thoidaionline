import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {taskAttachmentMetadata} from './taskAttachmentPolicy.mjs';
const id='11111111-1111-4111-8111-111111111111';const actor={id,role_code:'cong_tac_vien'};
const context={params:Promise.resolve({id,itemId:id})};
async function load(file,deps){
 let source=readFileSync(file,'utf8').replace(/import \{([^}]+)\} from [^;]+;/g,(_,names)=>`const {${names.replace(/\bas\b/g,':')}}=globalThis.__libraryRouteDeps;`);
 globalThis.__libraryRouteDeps=deps;
 source=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${Math.random()}`);
}
const apiError=(error,status)=>Response.json({error},{status});
function dependencies({member=true,registration=true,download=true}={}){
 const calls=[];const deps={apiError,apiJson:(data,status=200)=>Response.json(data,{status}),asUuid:v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v)?v:null,readJsonObject:r=>r.json(),requireReadActor:async()=>({ok:true,actor}),requireMutationActor:async()=>({ok:true,actor}),rpcFailure:e=>apiError(e.code,e.code==='42501'?403:409),randomUUID:()=>id,taskAttachmentMetadata,
 projectRepository:{listMembers:async()=>({ok:true,data:member?[{user_id:id,staff_users:{active:true}}]:[]})},
 projectLibraryRepository:{addItem:async(...args)=>{calls.push(['register',...args]);return registration?{ok:true,data:{id}}:{ok:false,error:{code:'42501'}};},file:async()=>{calls.push(['file']);return download?{ok:true,data:{kind:'file',storage_path:'stored/path.pdf',file_name:'report.pdf'}}:{ok:false,error:{code:'42501'}};}},
 serverSupabase:{storage:{from:bucket=>{assert.equal(bucket,'task-private');return {upload:async(...args)=>{calls.push(['upload',...args]);return {error:null};},remove:async(...args)=>calls.push(['remove',...args]),createSignedUrl:async(...args)=>{calls.push(['sign',...args]);return {data:{signedUrl:'https://example.test/download'},error:null};}};}}}};
 return {deps,calls};
}
function uploadRequest(){const form=new FormData();form.set('file',new File(['data'],'report.pdf',{type:'application/pdf'}));return new Request('http://localhost',{method:'POST',body:form});}
test('library upload denies nonmembers before storage and removes orphan bytes on registration denial',async()=>{
 for(const member of [false,true]){const {deps,calls}=dependencies({member,registration:false});const route=await load('src/app/api/projects/[id]/library/route.ts',deps);assert.equal((await route.POST(uploadRequest(),context)).status,403);assert.deepEqual(calls.map(c=>c[0]),member?['upload','register','remove']:[]);}
});
test('CTV upload registers only generated project scoped paths and shared file metadata',async()=>{
 const {deps,calls}=dependencies();const route=await load('src/app/api/projects/[id]/library/route.ts',deps);assert.equal((await route.POST(uploadRequest(),context)).status,201);
 const registration=calls.find(c=>c[0]==='register');assert.equal(registration[1],actor.id);assert.equal(registration[2],id);assert.equal(registration[3].storagePath,`projects/${id}/${id}/${id}.pdf`);assert.equal(registration[3].sizeBytes,4);
});
test('download checks library RPC access and returns a same-origin stream URL, never a storage link',async()=>{
 for(const download of [false,true]){const {deps,calls}=dependencies({download});const route=await load('src/app/api/projects/[id]/library/download/[itemId]/route.ts',deps);const response=await route.GET(new Request('http://localhost'),context);assert.deepEqual(calls.map(c=>c[0]),['file']);if(download){const body=await response.json();assert.match(body.url,/^\/api\/projects\/[^/]+\/library\/file\/[^/]+\?disposition=attachment$/);}else assert.equal(response.status,403);}
});
test('library routes honor session/origin denial before repository access',async()=>{
 const route=await load('src/app/api/projects/[id]/library/route.ts',{requireReadActor:async()=>({ok:false,response:apiError('unauthenticated',401)}),requireMutationActor:async()=>({ok:false,response:apiError('origin',403)})});
 assert.equal((await route.GET(new Request('http://localhost'),context)).status,401);
 for(const method of ['POST','PATCH','DELETE'])assert.equal((await route[method](new Request('http://localhost'),context)).status,403);
});

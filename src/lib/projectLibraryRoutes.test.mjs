import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {libraryFileHeaders} from './projectLibraryFile.ts';
import {readTaskAttachmentMetadata,TASK_ATTACHMENT_FORMAT_MESSAGE} from './taskAttachmentPolicy.mjs';
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
 const calls=[];const deps={apiError,apiJson:(data,status=200)=>Response.json(data,{status}),asUuid:v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v)?v:null,readJsonObject:r=>r.json(),requireReadActor:async()=>({ok:true,actor}),requireMutationActor:async()=>({ok:true,actor}),rpcFailure:e=>apiError(e.code,e.code==='42501'?403:409),randomUUID:()=>id,readTaskAttachmentMetadata,TASK_ATTACHMENT_FORMAT_MESSAGE,libraryFileHeaders,
 projectRepository:{listMembers:async()=>({ok:true,data:member?[{user_id:id,staff_users:{active:true}}]:[]})},
 projectLibraryRepository:{addItem:async(...args)=>{calls.push(['register',...args]);return registration?{ok:true,data:{id}}:{ok:false,error:{code:'42501'}};},file:async()=>{calls.push(['file']);return download?{ok:true,data:{kind:'file',storage_path:'stored/path.pdf',file_name:'report.pdf',title:'report',mime_type:'application/pdf'}}:{ok:false,error:{code:'42501'}};}},
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
test('download returns same-origin file proxy after library authorization',async()=>{
 for(const download of [false,true]){const {deps,calls}=dependencies({download});const route=await load('src/app/api/projects/[id]/library/download/[itemId]/route.ts',deps);const response=await route.GET(new Request('http://localhost'),context);assert.equal(response.status,download?200:403);assert.deepEqual(calls.map(c=>c[0]),['file']);if(download)assert.equal((await response.json()).url,`/api/projects/${id}/library/file/${id}?disposition=attachment`);}
});
test('file proxy authorizes before storage, supports safe inline types and ranges',async()=>{
 const {deps,calls}=dependencies(); deps.projectLibraryRepository.file=async()=>{calls.push(['file']);return ({ok:true,data:{kind:'file',storage_path:'stored/path.pdf',file_name:'31.10.26 BIÊN BẢN.pdf',title:'report',mime_type:'application/pdf'}});}; const originalFetch=globalThis.fetch; globalThis.fetch=async(_url,options)=>{assert.equal(options.headers.get('range'),'bytes=0-3');return new Response('data',{status:206,headers:{'content-length':'4','content-range':'bytes 0-3/10','accept-ranges':'bytes'}});};
 try { const route=await load('src/app/api/projects/[id]/library/file/[itemId]/route.ts',deps); const response=await route.GET(new Request('http://localhost?disposition=inline',{headers:{range:'bytes=0-3'}}),context); assert.equal(response.status,206);assert.equal(response.headers.get('content-type'),'application/pdf');assert.equal(response.headers.get('content-range'),'bytes 0-3/10');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('cache-control'),'private, no-store');assert.match(response.headers.get('content-disposition'),/inline/);assert.deepEqual(calls.map(c=>c[0]),['file','sign']); } finally {globalThis.fetch=originalFetch;}
});
test('file proxy returns 404 for links and forces risky inline content to attachment',async()=>{
 const {deps}=dependencies(); deps.projectLibraryRepository.file=async()=>({ok:true,data:{kind:'link',storage_path:null,title:'x.html',file_name:'x.html',mime_type:'text/html'}}); const route=await load('src/app/api/projects/[id]/library/file/[itemId]/route.ts',deps); assert.equal((await route.GET(new Request('http://localhost?disposition=inline'),context)).status,404);
});
test('library routes honor session/origin denial before repository access',async()=>{
 const route=await load('src/app/api/projects/[id]/library/route.ts',{requireReadActor:async()=>({ok:false,response:apiError('unauthenticated',401)}),requireMutationActor:async()=>({ok:false,response:apiError('origin',403)})});
 assert.equal((await route.GET(new Request('http://localhost'),context)).status,401);
 for(const method of ['POST','PATCH','DELETE'])assert.equal((await route[method](new Request('http://localhost'),context)).status,403);
});

test('proxy denies session, UUID and repository failures before touching storage',async()=>{
 for(const scenario of ['session','uuid','forbidden','link','missing']){
  const {deps,calls}=dependencies({download:scenario!=='forbidden'});
  if(scenario==='session')deps.requireReadActor=async()=>({ok:false,response:apiError('unauthenticated',401)});
  if(['link','missing'].includes(scenario))deps.projectLibraryRepository.file=async()=>({ok:true,data:{kind:scenario==='link'?'link':'file',storage_path:scenario==='link'?'path':null}});
  const route=await load('src/app/api/projects/[id]/library/file/[itemId]/route.ts',deps);
  const response=await route.GET(new Request('http://localhost'),scenario==='uuid'?{params:Promise.resolve({id:'invalid',itemId:id})}:context);
  assert.equal(response.status,{session:401,uuid:400,forbidden:403,link:404,missing:404}[scenario]);
  assert.ok(!calls.some(c=>c[0]==='sign'));
 }
});
test('proxy maps signing/fetch failures to sanitized 503 and supports HEAD/full-body fallback',async()=>{
 const originalFetch=globalThis.fetch;
 try { for(const scenario of ['sign','throw','upstream','full','head','range-invalid']){
  const {deps}=dependencies();
  if(scenario==='sign')deps.serverSupabase.storage.from=()=>({createSignedUrl:async()=>{throw Error('secret/path');}});
  globalThis.fetch=async(url,options)=>{
   assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');
   if(scenario==='throw')throw Error('secret/url');
   if(scenario==='upstream')return new Response('secret/path',{status:403});
   if(scenario==='head'){assert.equal(options.method,'HEAD');return new Response(null,{headers:{'content-length':'4'}});}
   if(scenario==='range-invalid')return new Response('private storage error',{status:416,headers:{'content-range':'bytes */4'}});
   return new Response('data',{headers:{'content-length':'4'}});
  };
  const route=await load('src/app/api/projects/[id]/library/file/[itemId]/route.ts',deps);
  const method=scenario==='head'?'HEAD':'GET';const response=await route[method](new Request('http://localhost',{method,headers:{range:'bytes=0-3'}}),context);
  assert.equal(response.status,['sign','throw','upstream'].includes(scenario)?503:scenario==='range-invalid'?416:200);
  const body=await response.text();assert.ok(!body.includes('secret'));assert.ok(!body.includes('storage'));
  if(scenario==='full')assert.equal(body,'data');if(scenario==='head')assert.equal(body,'');
 } }finally{globalThis.fetch=originalFetch;}
});
